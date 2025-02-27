import React, { useState, useEffect } from 'react';
import cv from 'opencv.js';
import './OpenCVProcessor.css';

const OpenCVProcessor = ({ images }) => {
  const [processedImages, setProcessedImages] = useState([]);

  useEffect(() => {
    const processImage = (image) => {
      const mat = cv.imread(image);
      const gray = new cv.Mat();
      cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);
      const thresh = new cv.Mat();
      cv.threshold(gray, thresh, 0, 255, cv.THRESH_BINARY_INV + cv.THRESH_OTSU);
      const contours = new cv.MatVector();
      cv.findContours(thresh, contours, new cv.Mat(), cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      const result = new cv.Mat();
      cv.drawContours(result, contours, -1, new cv.Scalar(0, 255, 0), 2);
      const imageData = cv.imencode('.jpg', result);
      setProcessedImages([...processedImages, imageData]);
    };

    images.forEach((image) => {
      processImage(image);
    });
  }, [images]);

  return (
    <div>
      {processedImages.map((image, index) => (
        <img key={index} src={image} alt={`Foto procesada ${index + 1}`} style={{ width: '100%', height: '100%' }} />
      ))}
    </div>
  );
};

export default OpenCVProcessor;