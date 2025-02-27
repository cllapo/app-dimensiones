import { useRef, useState } from "react";

const Camera = ({ onCapture }) => {
    const videoRef = useRef(null);
    const [stream, setStream] = useState(null);

    const startCamera = async () => {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoRef.current.srcObject = mediaStream;
        setStream(mediaStream);
    };

    const capturePhoto = () => {
        const canvas = document.createElement("canvas");
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(videoRef.current, 0, 0);
        onCapture(canvas.toDataURL("image/png"));
    };

    return (
        <div>
            <video ref={videoRef} autoPlay playsInline style={{ width: "300px" }} />
            <div>
                <button onClick={startCamera}>Iniciar Cámara</button>
                <button onClick={capturePhoto} disabled={!stream}>
                    Capturar Foto
                </button>
            </div>
        </div>
    );
};

export default Camera;
