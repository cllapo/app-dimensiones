import { useState, useRef, useEffect } from "react";
import cv from "@techstark/opencv-js";
import './styles.css';



function Camera({ onCapture }) {
    const videoRef = useRef(null);

    useEffect(() => {
        const startCamera = async () => {
            try {
                // Solicitar permisos de acceso a la cámara
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                if (videoRef.current) {
                    videoRef.current.srcObject = stream;
                }

                // Obtener todos los dispositivos de medios disponibles después de obtener el stream
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = devices.filter(device => device.kind === "videoinput");

                // Encontrar la cámara trasera buscando la etiqueta 'back' o 'rear' (si disponible)
                const backCamera = videoDevices.find(device =>
                    device.label.toLowerCase().includes("back") || device.label.toLowerCase().includes("rear")
                );

                // Si encontramos la cámara trasera, la seleccionamos
                if (backCamera) {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: { deviceId: backCamera.deviceId }
                    });
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                }

            } catch (error) {
                console.error("Error accediendo a la cámara:", error);
            }
        };

        startCamera();

        return () => {
            // Limpiar el stream cuando el componente se desmonta
            if (videoRef.current && videoRef.current.srcObject) {
                videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
            }
        };
    }, []);

    const capturePhoto = (photoNumber) => {
        if (!videoRef.current) return;
        const canvas = document.createElement("canvas");
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(videoRef.current, 0, 0);
        const imageData = canvas.toDataURL("image/png");
        onCapture(imageData, photoNumber);
    };

    return (
        <div>
            <video ref={videoRef} autoPlay playsInline style={{ width: "100%" }} />
            <button onClick={() => capturePhoto(1)}>Capturar Foto 1</button>
            <button onClick={() => capturePhoto(2)}>Capturar Foto 2</button>
        </div>
    );
}


function ImageDisplay({ photo1, photo2 }) {
    return (
        <div>
            {photo1 && <img src={photo1} alt="Foto 1" style={{ width: "45%" }} />}
            {photo2 && <img src={photo2} alt="Foto 2" style={{ width: "45%" }} />}
        </div>
    );
}

function App() {
    const [photo1, setPhoto1] = useState(null);
    const [photo2, setPhoto2] = useState(null);
    const [dimensions, setDimensions] = useState(null);
    const [roomType, setRoomType] = useState("");
    const [luminaireType, setLuminaireType] = useState("");
    const [luminaireCount, setLuminaireCount] = useState(null);
    const canvasRef = useRef(null);

    const handleCapture = (image, photoNumber) => {
        if (photoNumber === 1) setPhoto1(image);
        if (photoNumber === 2) setPhoto2(image);
    };

    const calculateDimensions = () => {
        if (!photo1 || !photo2) {
            alert("Por favor, capture ambas fotos antes de calcular.");
            return;
        }

        const imgElement1 = new Image();
        const imgElement2 = new Image();

        imgElement1.src = photo1;
        imgElement2.src = photo2;

        imgElement2.onload = () => {
            const img1 = cv.imread(imgElement1);
            const img2 = cv.imread(imgElement2);

            const gray1 = new cv.Mat();
            const gray2 = new cv.Mat();
            cv.cvtColor(img1, gray1, cv.COLOR_RGBA2GRAY);
            cv.cvtColor(img2, gray2, cv.COLOR_RGBA2GRAY);

            const orb = new cv.ORB();
            const keypoints1 = new cv.KeyPointVector();
            const keypoints2 = new cv.KeyPointVector();
            const descriptors1 = new cv.Mat();
            const descriptors2 = new cv.Mat();

            orb.detectAndCompute(gray1, new cv.Mat(), keypoints1, descriptors1);
            orb.detectAndCompute(gray2, new cv.Mat(), keypoints2, descriptors2);

            const matcher = new cv.BFMatcher(cv.NORM_HAMMING, true);
            const matches = new cv.DMatchVector();
            matcher.match(descriptors1, descriptors2, matches);

            console.log("Coincidencias:", matches.size());

            if (matches.size() < 4) {
                alert("No hay suficientes coincidencias para calcular dimensiones.");
                return;
            }

            const points1 = [];
            const points2 = [];

            for (let i = 0; i < matches.size(); i++) {
                const match = matches.get(i);
                const kp1 = keypoints1.get(match.queryIdx);
                const kp2 = keypoints2.get(match.trainIdx);

                points1.push(kp1.pt.x, kp1.pt.y);
                points2.push(kp2.pt.x, kp2.pt.y);
            }

            const matPoints1 = cv.matFromArray(points1.length / 2, 1, cv.CV_32FC2, points1);
            const matPoints2 = cv.matFromArray(points2.length / 2, 1, cv.CV_32FC2, points2);

            const homography = cv.findHomography(matPoints1, matPoints2, cv.RANSAC);

            if (!homography || homography.data64F.length !== 9) {
                alert("No se pudo calcular la matriz de homografía.");
                return;
            }

            console.log("Matriz de homografía:", homography.data64F);

            const scale = 3.0;
            const width = Math.abs(homography.data64F[0]) * scale;
            const height = Math.abs(homography.data64F[4]) * scale;
            const depth = Math.abs(homography.data64F[8]) * scale;

            setDimensions({ width, height, depth });

            img1.delete();
            img2.delete();
            gray1.delete();
            gray2.delete();
            keypoints1.delete();
            keypoints2.delete();
            descriptors1.delete();
            descriptors2.delete();
            matches.delete();
            matPoints1.delete();
            matPoints2.delete();
            homography.delete();
        };
    };

    const calculateLuminaires = () => {
        if (!dimensions || !roomType || !luminaireType) {
            alert("Por favor, complete todos los datos antes de calcular luminarias.");
            return;
        }

        const area = dimensions.width * dimensions.height;
        let lumensPerSquareMeter = 300; // Valor base

        if (roomType === "oficina") lumensPerSquareMeter = 500;
        if (roomType === "hospital") lumensPerSquareMeter = 700;

        const totalLumens = area * lumensPerSquareMeter;
        const lumensPerLuminaire = luminaireType === "led" ? 1500 : 1000;

        setLuminaireCount(Math.ceil(totalLumens / lumensPerLuminaire));
    };

    const drawLuminaireLayout = () => {
        if (!dimensions || luminaireCount === null) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        
        const roomWidth = dimensions.width * 100; // escala 1m = 100px
        const roomHeight = dimensions.height * 100; // escala 1m = 100px
        
        // Dibujar el rectángulo de la habitación
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeRect(50, 50, roomWidth, roomHeight);

        const luminairesPerRow = Math.ceil(Math.sqrt(luminaireCount));
        const luminaireSpacingX = roomWidth / luminairesPerRow;
        const luminaireSpacingY = roomHeight / luminairesPerRow;

        // Dibujar luminarias en el espacio disponible
        let luminaireIndex = 0;
        for (let row = 0; row < luminairesPerRow; row++) {
            for (let col = 0; col < luminairesPerRow; col++) {
                if (luminaireIndex >= luminaireCount) break;
                const x = 50 + col * luminaireSpacingX + luminaireSpacingX / 2;
                const y = 50 + row * luminaireSpacingY + luminaireSpacingY / 2;
                ctx.beginPath();
                ctx.arc(x, y, 10, 0, 2 * Math.PI);
                ctx.fillStyle = "yellow"; // color de la luminaria
                ctx.fill();
                luminaireIndex++;
            }
        }
    };

    return (
        <div>
            <h1>Calculadora de Luminarias</h1>
            <Camera onCapture={handleCapture} />
            <ImageDisplay photo1={photo1} photo2={photo2} />
            <button onClick={calculateDimensions}>Calcular Dimensiones</button>
            {dimensions && (
                <div>
                    <p>Ancho: {dimensions.width.toFixed(2)} m</p>
                    <p>Alto: {dimensions.height.toFixed(2)} m</p>
                    <p>Profundidad: {dimensions.depth.toFixed(2)} m</p>
                    <select onChange={(e) => setRoomType(e.target.value)}>
                        <option value="">Seleccione tipo de habitación</option>
                        <option value="oficina">Oficina</option>
                        <option value="hospital">Hospital</option>
                        <option value="cocina">Cocina</option>
                        <option value="dormitorio">Dormitorio</option>
                        <option value="baño">Baño</option>
                    </select>
                    <select onChange={(e) => setLuminaireType(e.target.value)}>
                        <option value="">Seleccione tipo de luminaria</option>
                        <option value="led">LED</option>
                        <option value="fluorescente">Fluorescente</option>
                    </select>
                    <button onClick={calculateLuminaires}>Calcular Luminarias</button>
                    {luminaireCount && <p>Número de luminarias necesarias: {luminaireCount}</p>}
                </div>
            )}
            <canvas ref={canvasRef} width="800" height="600" style={{ border: "1px solid black", marginTop: "20px" }}></canvas>
            <button onClick={drawLuminaireLayout}>Generar Ubicación de Luminarias</button>
        </div>
    );
}

export default App;