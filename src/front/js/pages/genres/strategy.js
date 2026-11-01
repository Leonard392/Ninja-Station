import React, { useContext, useEffect, useState, useCallback, useRef } from "react";
import { Context } from "../../store/Context.js";
import { GameCard } from "../../component/cards/gameCard.jsx";
import { Sidebar } from "../../component/sidebar.jsx";
import "../../../styles/genres.css";

export const Strategy = () => {
    const { store, actions } = useContext(Context);

    const [games, setGames] = useState([]);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);

    const observer = useRef();
    const lastGameCard = useCallback(node => {
        if(loading) return ;
        if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting){
             setPage(page => page && page+1);
        }
    }, {threshold: 0.1, rootMargin: "300px"});
    if (node) observer.current.observe(node);
    }, [loading]);

    const getGames = () =>{
        setLoading(true);
        let url = `/api/igdb/games?genres=strategy&page=${page}`;
        fetch(url)
            .then(response => response.json())
            .then(data => {
                if (!data.next){
                    setPage(null);
                }
                    setGames(currentGamesList => {
                        const existingIds = new Set(currentGamesList.map(game => game.id));
                        const uniqueGames = Array.isArray(data.results) ? data.results.filter(game => !existingIds.has(game.id)) : [];
                        return [...currentGamesList, ...uniqueGames];
                    });
                    setLoading(false);
            })
                    .catch(err => {
                        setLoading(false);
                        console.error(err);
                    }); // Log error to console
    };


    useEffect(() => {
        if (page){
            getGames();
        }
    }, [page]);

    return (
        <div className="games-body">
            <div className="row">
                <Sidebar/>
                <div className="games-list">
                <h1><span>Strategy</span> Games</h1>
                    <div className="row small-games-list">
                        {games.map(game => (
                            <div className="col-lg-4 col-md-6 col-sm-9" key={game.id}>
                                <GameCard game={game} fowardRef={lastGameCard}/>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
