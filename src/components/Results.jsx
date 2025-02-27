const Results = ({ dimensions }) => {
    return (
        <div>
            <h2>Dimensiones Calculadas:</h2>
            <p>Ancho: {dimensions?.width} m</p>
            <p>Altura: {dimensions?.height} m</p>
            <p>Longitud: {dimensions?.length} m</p>
        </div>
    );
};

export default Results;
