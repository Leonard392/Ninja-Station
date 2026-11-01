import { useState } from "react";

export const getState = ({ getStore, getActions, setStore }) => {

	const PAGE_SIZE = 20; // Number of games per page
	const [error, setError] = useState(null);

	return {
		store: {
			token: localStorage.getItem('token'),
			error: null,
			favoritesGames: [],
			favoritesCreators: [],
			favoritesStores: [],
			favoritesPlatforms: [],
			bestGames2024: [],
			topCreators: [],
			topCreatorsNextPage: null,
			topCreatorsLoading: false,
			Platforms: [],
			platformsNextPage: null,
			platformsLoading: false,
			Stores: []
		},
		actions: {
			//Fetchs From my API

			signUp: async (username, password) => {
				try {
					const response = await fetch('/api/signup', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({ username, password })
					});

					const data = await response.json();
					if (!response.ok) {
						throw new Error(data.message || 'Failed to sign up');
					}


					const currentToken = data.access_token;
					localStorage.setItem('token', currentToken);
					setStore({ token: currentToken });
					setError(null);
					console.log('store.token:', currentToken); // Accedemos directamente al token actual
					console.log('localStorage.token:', localStorage.getItem('token'));
				} catch (error) {
					console.error('Error signing up:', error);
					setError(error.message);
					throw error;
				}
			},

			login: async (username, password) => {
				try {
					// Realiza una solicitud POST al endpoint de login
					const response = await fetch('/api/login', {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json'
						},
						body: JSON.stringify({ username, password })
					});

					// Verifica si la solicitud fue exitosa
					const data = await response.json();
					if (!response.ok) {
						throw new Error(data.message || 'Failed to log in');
					}


					const currentToken = data.access_token;
					localStorage.setItem('token', currentToken);
					setStore({ token: currentToken });
					setError(null);
					console.log('store.token:', currentToken); // Accedemos directamente al token actual
					console.log('localStorage.token:', localStorage.getItem('token'));
				} catch (error) {
					console.error('Error logging in:', error);
					setError(error.message);
					throw error;
				}
			},

			logout: () => {
				console.log("Logged Out");
				localStorage.removeItem('token');
				setStore({ token: null });
				console.log('store.token:', null); // Accedemos directamente al token actual
				console.log('localStorage.token:', localStorage.getItem('token'));
			},



			//Favorite Games Functions



			addGameToFavorites: async (game) => {
				try {
					const response = await fetch("/api/favorites/games", {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"Authorization": `Bearer ${localStorage.getItem("token")}`
						},
						body: JSON.stringify({ game_id: game.id })
					});
					if (!response.ok) {
						throw new Error("Failed to add game to favorites");
					}
					// Manejar éxito
					const updatedFavorites = [...getStore().favoritesGames, game];
					setStore({ favoritesGames: updatedFavorites });
				} catch (error) {
					console.error("Error adding game to favorites:", error);
				}
			},

			removeGameFromFavorites: async (gameId) => {
				try {
					const token = localStorage.getItem('token');
					const response = await fetch(`/api/favorites/games/${gameId}`, {
						method: 'DELETE',
						headers: {
							'Authorization': `Bearer ${token}`
						}
					});

					if (!response.ok) {
						throw new Error('Failed to remove game from favorites');
					}

					console.log('Game removed from favorites successfully');
					// actualizar el estado para reflejar el cambio
					const updatedFavorites = getStore().favoritesGames.filter(favoriteId => favoriteId.id !== gameId);
					setStore({ favoritesGames: updatedFavorites });
				} catch (error) {
					console.error('Error removing game from favorites:', error);
					throw error;
				}
			},
			fetchUserFavoriteGames: async () => {
				try {
					const { token } = getStore(); // Obtener el token del store
					if (!token) {
						throw new Error("User not authenticated"); // Lanzar un error si el usuario no está autenticado
					}

					// Define la función fetchGameData aquí
					const fetchGameData = async (gameId) => {
						const response = await fetch(`/api/igdb/games/${gameId}`);
						const gameData = await response.json();
						return gameData;
					};

					const response = await fetch("/api/favorites/games", {
						headers: {
							Authorization: `Bearer ${token}`
						}
					});
					if (response.ok) {
						const data = await response.json();
						const gamesData = await Promise.all(data.map(id => fetchGameData(id)));

						const listaFavoritos = [...getStore().favoritesGames, ...gamesData];

						let unicos = [];

						// Declare an empty object
						let objetonUnicos = {};

						// Loop for the array elements
						for (let i in listaFavoritos) {
							// Extract the title
							let objTitle = listaFavoritos[i]['id'];

							// Use the title as the index
							objetonUnicos[objTitle] = listaFavoritos[i];
						}

						// Loop to push unique object into array
						for (let i in objetonUnicos) {
							unicos.push(objetonUnicos[i]);
						}

						setStore({

							favoritesGames: unicos
						});
					} else {
						throw new Error("Failed to fetch user favorites");
					}
				} catch (error) {
					console.error("Error fetching user favorites:", error);
				}
			},


			//Favorite Creators Functions

			addCreatorToFavorites: async (creator) => {
				try {
					const response = await fetch("/api/favorites/creators", {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"Authorization": `Bearer ${localStorage.getItem("token")}`
						},
						body: JSON.stringify({ creator_id: creator.id })
					});
					if (!response.ok) {
						throw new Error("Failed to add creator to favorites");
					}
					// Manejar éxito
					const updatedFavorites = [...getStore().favoritesCreators, creator];
					setStore({ favoritesCreators: updatedFavorites });
				} catch (error) {
					console.error("Error adding creator to favorites:", error);
				}
			},

			removeCreatorFromFavorites: async (creatorId) => {
				try {
					const token = localStorage.getItem('token');
					const response = await fetch(`/api/favorites/creators/${creatorId}`, {
						method: 'DELETE',
						headers: {
							'Authorization': `Bearer ${token}`
						}
					});

					if (!response.ok) {
						throw new Error('Failed to remove creator from favorites');
					}

					console.log('Creator removed from favorites successfully');
					// actualizar el estado para reflejar el cambio
					const updatedFavorites = getStore().favoritesCreators.filter(favoriteId => favoriteId.id !== creatorId);
					setStore({ favoritesCreators: updatedFavorites });
				} catch (error) {
					console.error('Error removing creator from favorites:', error);
					throw error;
				}
			},
			fetchUserFavoriteCreators: async () => {
				try {
					const { token } = getStore(); // Obtener el token del store
					if (!token) {
						throw new Error("User not authenticated"); // Lanzar un error si el usuario no está autenticado
					}

					// Define la función fetchGameData aquí
					const fetchCreatorData = async (creatorId) => {
						const response = await fetch(`/api/igdb/creators/${creatorId}`);
						const creatorData = await response.json();
						return creatorData;
					};

					const response = await fetch("/api/favorites/creators", {
						headers: {
							Authorization: `Bearer ${token}`
						}
					});
					if (response.ok) {
						const data = await response.json();
						const creatorsData = await Promise.all(data.map(id => fetchCreatorData(id)));

						const listaFavoritos = [...getStore().favoritesCreators, ...creatorsData];

						let unicos = [];

						// Declare an empty object
						let objetonUnicos = {};

						// Loop for the array elements
						for (let i in listaFavoritos) {
							// Extract the title
							let objTitle = listaFavoritos[i]['id'];
							// Use the title as the index
							objetonUnicos[objTitle] = listaFavoritos[i];
						}

						// Loop to push unique object into array
						for (let i in objetonUnicos) {
							unicos.push(objetonUnicos[i]);
						}

						setStore({

							favoritesCreators: unicos
						});
					} else {
						throw new Error("Failed to fetch user favorites");
					}
				} catch (error) {
					console.error("Error fetching user favorites:", error);
				}
			},

			//Favorite Platforms Functions


			addPlatformToFavorites: async (platform) => {
				try {
					const response = await fetch("/api/favorites/platforms", {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							"Authorization": `Bearer ${localStorage.getItem("token")}`
						},
						body: JSON.stringify({ platform_id: platform.id })
					});
					if (!response.ok) {
						throw new Error("Failed to add platform to favorites");
					}
					// Manejar éxito
					const updatedFavorites = [...getStore().favoritesPlatforms, platform];
					setStore({ favoritesPlatforms: updatedFavorites });
				} catch (error) {
					console.error("Error adding platform to favorites:", error);
				}
			},

			removePlatformFromFavorites: async (platformId) => {
				try {
					const token = localStorage.getItem('token');
					const response = await fetch(`/api/favorites/platforms/${platformId}`, {
						method: 'DELETE',
						headers: {
							'Authorization': `Bearer ${token}`
						}
					});

					if (!response.ok) {
						throw new Error('Failed to remove platform from favorites');
					}

					console.log('Platform removed from favorites successfully');
					// actualizar el estado para reflejar el cambio
					const updatedFavorites = getStore().favoritesPlatforms.filter(favoriteId => favoriteId.id !== platformId);
					setStore({ favoritesPlatforms: updatedFavorites });
				} catch (error) {
					console.error('Error removing game from favorites:', error);
					throw error;
				}
			},
			fetchUserFavoritePlatforms: async () => {
				try {
					const { token } = getStore(); // Obtener el token del store
					if (!token) {
						throw new Error("User not authenticated"); // Lanzar un error si el usuario no está autenticado
					}

					// Define la función fetchGameData aquí
					const fetchPlatformData = async (platformId) => {
						const response = await fetch(`/api/igdb/platforms/${platformId}`);
						const platformData = await response.json();
						return platformData;
					};

					const response = await fetch("/api/favorites/platforms", {
						headers: {
							Authorization: `Bearer ${token}`
						}
					});
					if (response.ok) {
						const data = await response.json();
						const platformsData = await Promise.all(data.map(id => fetchPlatformData(id)));

						const listaFavoritos = [...getStore().favoritesPlatforms, ...platformsData];

						let unicos = [];

						// Declare an empty object
						let objetonUnicos = {};

						// Loop for the array elements
						for (let i in listaFavoritos) {
							// Extract the title
							let objTitle = listaFavoritos[i]['id'];

							// Use the title as the index
							objetonUnicos[objTitle] = listaFavoritos[i];
						}

						// Loop to push unique object into array
						for (let i in objetonUnicos) {
							unicos.push(objetonUnicos[i]);
						}

						setStore({

							favoritesPlatforms: unicos
						});
					} else {
						throw new Error("Failed to fetch user favorites");
					}
				} catch (error) {
					console.error("Error fetching user favorites:", error);
				}
			},


			//Fetchs from Rawg.io API


			fetchBestGames2024: async () => {
				try {
					const response = await fetch(`/api/igdb/games?dates=2024-01-01,2024-12-31&ordering=-added&page_size=${PAGE_SIZE}`);
					const data = await response.json();
					setStore({ bestGames2024: response.ok && Array.isArray(data.results) ? data.results : [] });
				} catch (error) {
					setStore({ bestGames2024: [] });
					console.error('Error fetching best games of 2024', error);
				}
			},
			fetchTopCreators: async () => {
				try {
					const response = await fetch(`/api/igdb/creators?page=1&page_size=${PAGE_SIZE}`);
					const data = await response.json();
					setStore({
						topCreators: response.ok && Array.isArray(data.results) ? data.results : [],
						topCreatorsNextPage: response.ok ? data.next : null
					});
				} catch (error) {
					setStore({ topCreators: [], topCreatorsNextPage: null });
					console.error('Error fetching top creators', error);
				}
			},
			fetchMoreTopCreators: async () => {
				const current = getStore();
				if (!current.topCreatorsNextPage || current.topCreatorsLoading) return;
				setStore({ topCreatorsLoading: true });
				try {
					const response = await fetch(`/api/igdb/creators?page=${current.topCreatorsNextPage}&page_size=${PAGE_SIZE}`);
					const data = await response.json();
					if (response.ok && Array.isArray(data.results)) {
						const existingIds = new Set(getStore().topCreators.map(item => item.id));
						const uniqueResults = data.results.filter(item => !existingIds.has(item.id));
						setStore({ topCreators: [...getStore().topCreators, ...uniqueResults], topCreatorsNextPage: data.next, topCreatorsLoading: false });
					} else {
						setStore({ topCreatorsNextPage: null, topCreatorsLoading: false });
					}
				} catch (error) {
					setStore({ topCreatorsLoading: false, topCreatorsNextPage: null });
					console.error('Error fetching more creators', error);
				}
			},
			fetchPlatforms: async () => {
				try {
					const response = await fetch(`/api/igdb/platforms?page=1&page_size=${PAGE_SIZE}`);
					const data = await response.json();
					setStore({
						Platforms: response.ok && Array.isArray(data.results) ? data.results : [],
						platformsNextPage: response.ok ? data.next : null
					});
				} catch (error) {
					setStore({ Platforms: [], platformsNextPage: null });
					console.error('Error fetching top platforms', error);
				}
			},
			fetchMorePlatforms: async () => {
				const current = getStore();
				if (!current.platformsNextPage || current.platformsLoading) return;
				setStore({ platformsLoading: true });
				try {
					const response = await fetch(`/api/igdb/platforms?page=${current.platformsNextPage}&page_size=${PAGE_SIZE}`);
					const data = await response.json();
					if (response.ok && Array.isArray(data.results)) {
						const existingIds = new Set(getStore().Platforms.map(item => item.id));
						const uniqueResults = data.results.filter(item => !existingIds.has(item.id));
						setStore({ Platforms: [...getStore().Platforms, ...uniqueResults], platformsNextPage: data.next, platformsLoading: false });
					} else {
						setStore({ platformsNextPage: null, platformsLoading: false });
					}
				} catch (error) {
					setStore({ platformsLoading: false, platformsNextPage: null });
					console.error('Error fetching more platforms', error);
				}
			},
			fetchStores: async () => {
				try {
					const response = await fetch(`/api/igdb/stores?page_size=${PAGE_SIZE}`);
					const data = await response.json();
					setStore({ Stores: response.ok && Array.isArray(data.results) ? data.results : [] });
				} catch (error) {
					setStore({ Stores: [] });
					console.error('Error fetching top stores', error);
				}
			}
		}
	};
};
