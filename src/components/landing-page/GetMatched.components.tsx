import { useEffect, useState } from 'react';

export const GetMatched = () => {
  const [isImage1Visible, setIsImage1Visible] = useState<boolean>(true);
  const [isImage2Visible, setIsImage2Visible] = useState<boolean>(false);

  useEffect(() => {
    const intervalId1 = setInterval(() => {
      setIsImage1Visible(!isImage1Visible);
    }, 1500);

    const intervalId2 = setInterval(() => {
      setIsImage2Visible(!isImage2Visible);
    }, 1500);

    return () => {
      clearInterval(intervalId1);
      clearInterval(intervalId2);
    };
  }, [isImage1Visible, isImage2Visible]);

  return (
    <>
      <div className="h-screen w-full flex justify-center items-center">
        <div className="flex items-center gap-[48px]">
          {/* Info Text */}
          <div className="flex flex-col max-w-[658px] gap-[54px]">
            {/* Heading */}
            <h1 className="text-[60px] leading-[90px] font-bold">
              Get matched
            </h1>
            {/* Paragraph */}
            <p className="text-[22px] leading-[33px] font-medium">
              After searching for a subject, choose a skill level for your
              selected field. TalkThru’s technology will then match you with a
              random study partner. Once matched, you will be shown a preview of
              your partner, and be prompted to start a video session with them.
            </p>
          </div>
          {/* Image */}
          <div>
            <div className="">
              <img
                src="https://res.cloudinary.com/dryh1nvhk/image/upload/v1676769420/TalkThru/Landing%20Page/connect-2_xoscd3.png"
                alt=""
                className={`${
                  isImage2Visible ? 'scale-100' : 'scale-0'
                } relative top-[190px] left-[20px] transition-transform duration-500 transform`}
                style={{ opacity: isImage2Visible ? 1 : 0 }}
              />
              <img
                src="https://res.cloudinary.com/dryh1nvhk/image/upload/v1676769420/TalkThru/Landing%20Page/connect-1_in923h.png"
                alt=""
                className={`${
                  isImage1Visible ? 'scale-100' : 'scale-0'
                } relative top-[118px] left-[76px] transition-transform duration-500 transform`}
                style={{ opacity: isImage1Visible ? 1 : 0 }}
              />
            </div>
            <img
              src="https://res.cloudinary.com/dryh1nvhk/image/upload/v1676329594/TalkThru/Landing%20Page/get_matched_opdfil.png"
              alt="get-matched"
            />
          </div>
        </div>
      </div>
    </>
  );
};
