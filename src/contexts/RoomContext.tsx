import Peer from 'peerjs';
import { createContext, useEffect, useState, useReducer } from 'react';
import { useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { v4 as uuidV4 } from 'uuid';
import { addPeerAction, removePeerAction } from './peersActions';
import { peersReducer } from './peersReducer';

// Constant for the web socket URL
const WS = 'http://localhost:8080';

// Create a context for sharing data across components
export const RoomContext = createContext<null | any>(null);

// Initialize the WebSocket
const ws = io(WS);

// Room provider component to manage state and provide context
export const RoomProvider = ({ children }: { children: any }) => {
  // Hook for navigating between routes
  const navigate = useNavigate();
  // State to store the local peer
  const [me, setMe] = useState<Peer>();
  // State to store the local media stream
  const [stream, setStream] = useState<MediaStream>();
  // State managed by the peer reducer to store all connected peers
  const [peers, dispatch] = useReducer(peersReducer, {});
  // State to keep track of the peer who is currently screen sharing
  const [screenSharingId, setScreenSharingId] = useState<string>("");
  // State to keep track of the connections between all peers
  // You can correlate connections[i].peer to the keys in peers state
  const [connections, setConnections] = useState<any[]>([]);

  // Function to navigate to a specific room page
  const enterRoom = ({ roomId }: { roomId: string }) => {
    // Logging the room id to the console
    console.log({ roomId });

    // Navigating to the room page
    navigate(`/room/${roomId}`);
  };

  // Function to retrieve and log the list of participants in a room
  const getUsers = ({ participants }: { participants: string[] }) => {
    // Logging the list of participants to the console
    console.log({ participants });
  };

  // Function to remove a peer from the application's state
  const removePeer = (peerId: string) => {
    // Dispatching an action to remove the peer from the state
    dispatch(removePeerAction(peerId));

    // Update connections state by removing the connection to peerId
    setConnections((prevState) => prevState.filter((connection) => connection.peer !== peerId));
  };

  // Function to update the stream for local and remote peers
  const switchStream = (newStream: MediaStream) => {
    // Updates stream state
    setStream(newStream);
    // Uses optional chaining to set state as the peer's id or empty string
    setScreenSharingId(me?.id || "");

    // Store the video track of newStream to update all remote peer connections
    const videoTrack = newStream.getVideoTracks()[0];

    Object.values(connections).forEach((connection) => {
      // Access the RTCPeerConnection between local peer and remote peer
      connection.peerConnection
        // Get the RTCRtpSender that handles video streaming -> senders[0: audio, 1: video]
        .getSenders()[1]
        // Start sending newStream's videoTrack
        .replaceTrack(videoTrack)
        .catch((err: any) => console.error(err))
      });
  };

  // Function to set the user's display as their stream
  const shareScreen = () => {
    // Check if screen share is enabled
    if (screenSharingId) {
      // Enabled -> Revert local peer's media to default webcam
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then(switchStream);
    } else {
      // Not enabled -> Start screen share
      navigator.mediaDevices
        .getDisplayMedia({})
        .then(switchStream);
    }
  };

  // useEffect hook initializes the local peer and media stream
  useEffect(() => {
    // Generate a unique ID for the local peer
    const meId = uuidV4();
    // Create a new Peer instance with the generated ID
    const peer = new Peer(meId);

    // Store the local peer instance in the state
    setMe(peer);

    try {
      // Try to get the local media stream for audio and video
      navigator.mediaDevices
        .getUserMedia({ video: true, audio: true })
        .then((stream) => {
          // Store the local media stream in the state
          setStream(stream);
        });
    } catch (error) {
      // Log the error if getting the media stream fails
      console.log(error);
    }

    // Register event listeners for incoming websocket events
    ws.on('room-created', enterRoom);
    ws.on('get-users', getUsers);
    ws.on('user-disconnected', removePeer);
  }, []);

  // useEffect to handle incoming calls and outgoing calls
  useEffect(() => {
    // Exit if me or stream is not defined
    if (!me) return;
    if (!stream) return;

    // Register an event listener for a new peer joining
    ws.on('user-joined', ({ peerId }) => {
      // Make an outbound call to the new peer using their peerId and the local media stream
      const call = me.call(peerId, stream);
      // Store call/connection object in state
      setConnections((prevState) => [...prevState, call]);

      // Register an event listener for the peer stream
      call.on('stream', (peerStream) => {
        // Dispatch an action to add the new peer stream to the peers state
        dispatch(addPeerAction(peerId, peerStream));
      });
    });

    // Register an event listener for incoming calls
    me.on('call', (call) => {
      // Answer the incoming call with the local media stream
      call.answer(stream);
      // Register an event listener for the peer stream
      call.on('stream', (peerStream) => {
        // Dispatch an action to add the incoming peer stream to the peers state
        dispatch(addPeerAction(call.peer, peerStream));
      });
    });
  }, [me, stream]);

  // Log the current state of peers to the console
  console.log({ peers });

  // Render the RoomContext provider with websocket, peer, and stream as values
  return (
    <RoomContext.Provider value={{ ws, me, stream, peers, shareScreen }}>
      {children}
    </RoomContext.Provider>
  );
};
