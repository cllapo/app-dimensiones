import { useState, useRef, useEffect } from "react";
import cv from "@techstark/opencv-js";
import './styles.css';


function Camera({ onCapture }) {
    const videoRef = useRef(null);

    useEffect(() => {
        const startCamera = async () => {
            try {
                // Obtener todos los dispositivos de medios disponibles
                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoDevices = devices.filter(device => device.kind === "videoinput");

                // Buscar la cámara trasera (generalmente la primera cámara es la frontal, la segunda es la trasera)
                const backCamera = videoDevices.find(device => device.label.toLowerCase().includes('back') || device.label.toLowerCase().includes('rear'));

                if (backCamera) {
                    // Si encontramos la cámara trasera, la usamos
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: { deviceId: backCamera.deviceId }
                    });
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                } else {
                    // Si no encontramos una cámara trasera, podemos acceder a la cámara por defecto
                    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                    }
                }
            } catch (error) {
                console.error("Error accediendo a la cámara:", error);
            }
        };

        startCamera();

        return () => {
            if (videoRef.current && videoRef.current.srcObject) {
                videoRef.current.srcObject.getTracks().forEach(track => track.stop());
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
    
            // Convertir imágenes a escala de grises
            const gray1 = new cv.Mat();
            const gray2 = new cv.Mat();
            cv.cvtColor(img1, gray1, cv.COLOR_RGBA2GRAY);
            cv.cvtColor(img2, gray2, cv.COLOR_RGBA2GRAY);
    
            // Detectores de características y descriptores
            const orb = new cv.ORB();
            const keypoints1 = new cv.KeyPointVector();
            const keypoints2 = new cv.KeyPointVector();
            const descriptors1 = new cv.Mat();
            const descriptors2 = new cv.Mat();
    
            orb.detectAndCompute(gray1, new cv.Mat(), keypoints1, descriptors1);
            orb.detectAndCompute(gray2, new cv.Mat(), keypoints2, descriptors2);
    
            // Coincidencias de puntos entre las imágenes
            const matcher = new cv.BFMatcher(cv.NORM_HAMMING, true);
            const matches = new cv.DMatchVector();
            matcher.match(descriptors1, descriptors2, matches);
    
            console.log("Coincidencias encontradas:", matches.size());
    
            if (matches.size() < 4) {
                alert("No se encontraron suficientes coincidencias para calcular las dimensiones.");
                return;
            }
    
            // Extraer puntos de coincidencia
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
    
            // Calcular la homografía
            const homography = cv.findHomography(matPoints1, matPoints2, cv.RANSAC);
    
            if (!homography || homography.data64F.length !== 9) {
                alert("No se pudo calcular la matriz de homografía.");
                return;
            }
    
            console.log("Matriz de homografía:", homography.data64F);
    
            // Detectar códigos QR en ambas imágenes
            const qrDetector = new cv.QRCodeDetector();
            const qr1 = new cv.Mat();
            const qr2 = new cv.Mat();
    
            const qrFound1 = qrDetector.detect(gray1, qr1);
            const qrFound2 = qrDetector.detect(gray2, qr2);
    
            if (!qrFound1 || !qrFound2) {
                alert("No se detectaron códigos QR en ambas imágenes.");
                return;
            }
    
            // Obtener los puntos de los códigos QR
            const qrPoints1 = qr1.data32F;
            const qrPoints2 = qr2.data32F;
    
            // Definir el tamaño real del QR (en metros)
            const qrSizeReal = 0.15; // 15 cm en metros
    
            // Calcular la distancia entre los puntos del QR
            const dist1 = Math.sqrt(
                Math.pow(qrPoints1[2] - qrPoints1[0], 2) + Math.pow(qrPoints1[3] - qrPoints1[1], 2)
            );
            const dist2 = Math.sqrt(
                Math.pow(qrPoints2[2] - qrPoints2[0], 2) + Math.pow(qrPoints2[3] - qrPoints2[1], 2)
            );
    
            // Calcular las escalas basadas en los QR
            const scale1 = qrSizeReal / dist1;
            const scale2 = qrSizeReal / dist2;
    
            // Promediar las escalas
            const scale = (scale1 + scale2) / 2;
    
            // Calcular la distancia entre los QR en píxeles
            const qrCenter1 = [(qrPoints1[0] + qrPoints1[4]) / 2, (qrPoints1[1] + qrPoints1[5]) / 2];
            const qrCenter2 = [(qrPoints2[0] + qrPoints2[4]) / 2, (qrPoints2[1] + qrPoints2[5]) / 2];
            const pixelDistance = Math.sqrt(
                Math.pow(qrCenter2[0] - qrCenter1[0], 2) + Math.pow(qrCenter2[1] - qrCenter1[1], 2)
            );
    
            // Estimar las dimensiones de la habitación
            const roomWidth = pixelDistance * scale;
            const roomHeight = Math.max(qrSizeReal * (gray1.rows / dist1), qrSizeReal * (gray2.rows / dist2));
            const roomDepth = Math.abs(scale1 - scale2) * gray1.cols;
    
            setDimensions({ width: roomWidth, height: roomHeight, depth: roomDepth });
    
            // Liberar memoria
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
        
        // Dibujar el rectángulo de la habitación
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
                        <option value="">Seleccione tipo de habitación</option>
                        <option value="oficina">Oficina</option>
                        <option value="hospital">Hospital</option>
                        <option value="cocina">Cocina</option>
                        <option value="dormitorio">Dormitorio</option>
                        <option value="baño">Baño</option>
                    </select>
                    <select onChange={(e) => setLuminaireType(e.target.value)}>
                        <option value="">Seleccione tipo de luminaria</option>
                        <option value="led">LED</option>
                        <option value="fluorescente">Fluorescente</option>
                    </select>
                    <button onClick={calculateLuminaires}>Calcular Luminarias</button>
                    {luminaireCount && <p>Número de luminarias necesarias: {luminaireCount}</p>}
                </div>
            )}
            <canvas ref={canvasRef} width="800" height="600" style={{ border: "1px solid black", marginTop: "20px" }}></canvas>
            <button onClick={drawLuminaireLayout}>Generar Ubicación de Luminarias</button>
        </div>
    );
}

export default App;
