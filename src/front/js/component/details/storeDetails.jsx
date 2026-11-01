import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "../../../styles/details.css";


export const StoreDetails = ({ gameId }) => {
    const params = useParams();

    const [storeDetails, setStoreDetails] = useState(null);

    let url = '/api/igdb/stores/' + params.id;

    useEffect(() => {
        fetch(url)
            .then(response => response.json())
            .then(data => setStoreDetails(data))
            .catch(err => err);
    }, []);

    return (
        <div className="details">
            {storeDetails ? (
                <>
                    <div className="details-left">
                        {/* Imagen del creador */}
                        <img src={storeDetails.image_background} alt={storeDetails.name} className="details-img" />
                    </div>
                    <div className="details-right">
                        {/* Detalles de la plataforma */}
                        <h1><strong>STORE</strong> DETAILS</h1>
                        <h2>{storeDetails.name}</h2>
                        <p><strong><i className="fa-solid fa-gamepad"></i> Games Count:</strong> {storeDetails.games_count}</p>
                        <p><strong><i className="fa-solid fa-globe"></i> You can find us:</strong> {storeDetails.domain}</p>
                    </div>
                </>
            ) : (
                <p>Loading platform details...</p>
            )}
        </div>
    );
};
