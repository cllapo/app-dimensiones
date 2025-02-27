const ImageDisplay = ({ images }) => {
    return (
        <div>
            {images.map((img, index) => (
                <img key={index} src={img} alt={`Foto ${index + 1}`} style={{ width: "200px", margin: "10px" }} />
            ))}
        </div>
    );
};

export default ImageDisplay;
