import React, { useContext, useRef } from "react";
import { Context } from "../../store/Context.js";
import { Platformcard } from "../../component/cards/platformCard.jsx";

export const Platforms = () => {
  const { store, actions } = useContext(Context);
  const observer = useRef();
  const loading = store.platformsLoading;

  const sentinelRef = node => {
    if (loading || !store.platformsNextPage) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) actions.fetchMorePlatforms();
    }, { threshold: 0.1, rootMargin: "300px" });
    if (node) observer.current.observe(node);
  };

  return (
        <div className="others-body">
            <div className="main-component">
                <h1>Platforms</h1>
                <div className="row">
                    {store.Platforms.map((platform) => (
                    <div key={platform.id} className="col-lg-3 col-md-6 col-sm-12 others-cards">
                        <Platformcard platform={platform} />
                    </div>
                    ))}
                    {store.platformsNextPage && <div ref={sentinelRef} className="w-100 py-3 text-center">Loading more platforms...</div>}
                </div>
            </div>
        </div>
  );
};