import { createContext, useContext, useEffect, useState, useReducer } from 'react';
import { useNavigate } from 'react-router-dom';
import Peer from 'peerjs';
import { webSocket } from '../webSocket';
import {
	addPeerStreamAction,
	addPeerNameAction,
	removePeerStreamAction,
	addAllPeersAction,
} from '../reducers/peersActions';
import { peersReducer } from '../reducers/peersReducer';
import { UserContext } from './UserContext';

interface IPeer {
	userName: string;
	peerId: string;
}

// Create a context for sharing data across components
export const RoomContext = createContext<null | any>(null);

// Room provider component to manage state and provide context
export const RoomProvider = ({ children }: { children: any }) => {
	// Hook for navigating between routes
	const navigate = useNavigate();

	// State to store the local peer
	const [me, setMe] = useState<Peer>();
	// State to store the local media stream
	const [stream, setStream] = useState<MediaStream>();
	// State to keep track of the stream to share when screen sharing
	const [screenStream, setScreenStream] = useState<MediaStream>();
	// State to keep track of the peer who is currently screen sharing
	const [screenSharingId, setScreenSharingId] = useState<string>('');
	// State to keep track of data for remote peers
	const [peers, dispatch] = useReducer(peersReducer, {});
	// State to keep track of the room ID for the local peer
	const [roomId, setRoomId] = useState<string>('');
	// State to keep track of the connections between all peers
	// connections[i].peer correlates to the keys in peers state
	const [connections, setConnections] = useState<any[]>([]);

	// Destructure context for the props we need
	const { userName, userId } = useContext(UserContext);

	// Function to navigate to a specific room page
	const enterRoom = ({ roomId }: { roomId: string }) => {
		navigate(`/room/${roomId}`);
	};

	// Function to update 'peers' state with the list of participants in a room
	const getUsers = ({ participants }: { participants: Record<string, IPeer> }) => {
		dispatch(addAllPeersAction(participants));
	};

	// Function to remove a peer from the application's state
	const removePeer = (peerId: string) => {
		// Dispatching an action to remove the peer from the state
		dispatch(removePeerStreamAction(peerId));

		// Update connections state by removing the connection to peerId
		setConnections((prevState) => prevState.filter((connection) => connection.peer !== peerId));
	};

	// Function to update the stream for local and remote peers
	const switchStream = (newStream: MediaStream) => {
		// Uses ternary operator to to update state when stop/start sharing is triggered
		// For 'false' condition, 'me?.id' could be undefined, which is not a valid type for state so it defaults to empty string
		setScreenSharingId(screenSharingId ? '' : userId || '');

		// Store the video track of newStream to update all remote peer connections
		const videoTrack = newStream.getVideoTracks()[0];

		Object.values(connections).forEach((connection) => {
			// Access the RTCPeerConnection between local peer and remote peer
			connection.peerConnection
				// Get the RTCRtpSender that handles video streaming -> senders[0: audio, 1: video]
				.getSenders()[1]
				// Start sending newStream's videoTrack
				.replaceTrack(videoTrack)
				.catch((err: any) => console.error(err));
		});
	};

	// Function to set the user's display as their stream
	const shareScreen = () => {
		// Check if screen share is enabled
		if (screenSharingId) {
			// Enabled -> Revert local peer's media to default webcam
			navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
				switchStream(stream);
			});
		} else {
			// Not enabled -> Start screen share
			navigator.mediaDevices.getDisplayMedia({}).then((stream) => {
				switchStream(stream);
				setScreenStream(stream);
			});
		}
	};

	// useEffect hook initializes the local peer and media stream
	useEffect(() => {
		// Create a new Peer instance with userId state
		const peer = new Peer(userId);

		// Store the local peer instance in the state
		setMe(peer);

		try {
			// Try to get the local media stream for audio and video
			navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
				// Store the local media stream in the state
				setStream(stream);
			});
		} catch (error) {
			// Log the error if getting the media stream fails
			console.log(error);
		}

		// Register event listeners for incoming websocket events
		webSocket.on('room-created', enterRoom);
		webSocket.on('get-users', getUsers);
		webSocket.on('user-disconnected', removePeer);
		webSocket.on('user-started-sharing', (peerId) => setScreenSharingId(peerId));
		webSocket.on('user-stopped-sharing', () => setScreenSharingId(''));

		// Unsubscribe from all events when the component ummounts to prevent memory leaks
		return () => {
			webSocket.off('room-created');
			webSocket.off('get-users');
			webSocket.off('user-disconnected');
			webSocket.off('user-started-sharing');
			webSocket.off('user-stopped-sharing');
			webSocket.off('user-joined');
			me?.disconnect();
		};
	}, []);

	// Screen Sharing
	// Executes when a peer starts/stops sharing their screen or local peer leaves the room
	useEffect(() => {
		// Check if a peer started sharing their screen
		if (screenSharingId) {
			webSocket.emit('start-sharing', { peerId: screenSharingId, roomId });
		} else {
			webSocket.emit('stop-sharing');
		}
	}, [screenSharingId, roomId]);

	// useEffect to handle incoming and outgoing calls
	useEffect(() => {
		// Exit if me or stream is not defined
		if (!me) return;
		if (!stream) return;

		// Register an event listener for a new peer joining the room
		webSocket.on('user-joined', ({ peerId, userName: name }) => {
			// Make an outbound call to the new peer using their peerId and the local media stream
			// Passing data that other peers need to know as 'metadata' property
			const call = me.call(peerId, stream, {
				metadata: { userName },
			});

			// Register an event listener for the peer stream
			call.on('stream', (peerStream) => {
				// Dispatch an action to add/update the new peer stream to peers state
				dispatch(addPeerStreamAction(peerId, peerStream));
			});

			// Dispatch an action to add the new peer name to the peers state
			dispatch(addPeerNameAction(peerId, name));

			// Store call/connection object in state
			setConnections((prevState) => [...prevState, call]);
		});

		// Register an event listener for incoming calls
		me.on('call', (call) => {
			// Update peer state with user's Id
			const { userName } = call.metadata;
			dispatch(addPeerNameAction(call.peer, userName));

			// Answer the incoming call with the local media stream
			call.answer(stream);
			// Register an event listener for the peer stream
			call.on('stream', (peerStream) => {
				// Dispatch an action to add the incoming peer stream to the peers state
				dispatch(addPeerStreamAction(call.peer, peerStream));
			});
		});

		return () => {
			webSocket.off('user-joined');
		};
	}, [me, stream, userName]);

	// Log the current state of peers to the console
	// console.log({ me });
	// console.log({ peers });
	// console.log({ screenSharingId });
	// console.log({ connections });

	// Render the RoomContext provider with websocket, peer, and stream as values
	return (
		<RoomContext.Provider
			value={{
				stream,
				screenStream,
				screenSharingId,
				peers,
				shareScreen,
				setRoomId,
			}}>
			{children}
		</RoomContext.Provider>
	);
};
