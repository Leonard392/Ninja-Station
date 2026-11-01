import React, { useContext, useEffect, useRef } from "react";
import { Context } from "../../store/Context.js";
import { CreatorCard } from "../../component/cards/creatorCard.jsx";
import "../../../styles/others.css";

export const Creators = () => {
  const { store, actions } = useContext(Context);
  const observer = useRef();
  const loading = store.topCreatorsLoading;

  const sentinelRef = node => {
    if (loading || !store.topCreatorsNextPage) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) actions.fetchMoreTopCreators();
    }, { threshold: 0.1, rootMargin: "300px" });
    if (node) observer.current.observe(node);
  };

  return (
        <div className="others-body">
            <div className="main-component">
                <h1>Top Creators</h1>
                <div className="row">
                    {store.topCreators.map((creator) => (
                    <div key={creator.id} className="col-lg-3 col-md-6 col-sm-12 others-cards">
                        <CreatorCard creator={creator} />
                    </div>
                    ))}
                    {store.topCreatorsNextPage && <div ref={sentinelRef} className="w-100 py-3 text-center">Loading more creators...</div>}
                </div>
            </div>
        </div>
  );
};