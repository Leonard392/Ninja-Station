"""
This module takes care of starting the API Server, Loading the DB and Adding the endpoints
"""
from flask import Flask, request, jsonify, url_for, Blueprint
from api.models import db, User, FavoriteGame, FavoriteCreator, FavoritePlatform
from api.utils import generate_sitemap, APIException
from flask_cors import CORS
from flask_jwt_extended import create_access_token, get_jwt_identity, jwt_required
import os
import json
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from werkzeug.security import generate_password_hash, check_password_hash

api = Blueprint('api', __name__)

IGDB_ACCESS_TOKEN = None


def get_igdb_access_token():
    global IGDB_ACCESS_TOKEN
    if IGDB_ACCESS_TOKEN:
        return IGDB_ACCESS_TOKEN

    client_id = os.getenv('IGDB_CLIENT_ID')
    client_secret = os.getenv('IGDB_CLIENT_SECRET')
    if not client_id or not client_secret:
        raise ValueError("IGDB_CLIENT_ID and IGDB_CLIENT_SECRET are not configured")

    token_url = "https://id.twitch.tv/oauth2/token"
    body = urlencode({
        "client_id": client_id,
        "client_secret": client_secret,
        "grant_type": "client_credentials",
    }).encode("utf-8")
    token_request = Request(token_url, data=body, method="POST")
    with urlopen(token_request, timeout=15) as response:
        token_data = json.loads(response.read().decode("utf-8"))

    IGDB_ACCESS_TOKEN = token_data["access_token"]
    return IGDB_ACCESS_TOKEN


def igdb_request(endpoint, query):
    access_token = get_igdb_access_token()
    client_id = os.getenv('IGDB_CLIENT_ID')
    request_obj = Request(
        f"https://api.igdb.com/v4/{endpoint}",
        data=query.encode("utf-8"),
        headers={
            "Client-ID": client_id,
            "Authorization": f"Bearer {access_token}",
            "Accept": "application/json",
            "Content-Type": "text/plain",
        },
        method="POST",
    )
    with urlopen(request_obj, timeout=15) as response:
        return json.loads(response.read().decode("utf-8"))


def image_url(image_id, size="cover_big"):
    if not image_id:
        return ""
    return f"https://images.igdb.com/igdb/image/upload/t_{size}/{image_id}.jpg"


def normalize_game(game):
    cover = game.get("cover") or {}
    platforms = [{"platform": {"name": platform.get("name", "")}}
                  for platform in game.get("platforms") or []]
    genres = [{"name": genre.get("name", "")}
              for genre in game.get("genres") or []]
    involved = game.get("involved_companies") or []
    developers = [{"name": company.get("company", {}).get("name", "")}
                  for company in involved if company.get("developer")]
    publishers = [{"name": company.get("company", {}).get("name", "")}
                  for company in involved if company.get("publisher")]

    first_release_date = game.get("first_release_date")
    released = ""
    if first_release_date:
        from datetime import datetime, timezone
        released = datetime.fromtimestamp(first_release_date, timezone.utc).strftime("%Y-%m-%d")

    return {
        "id": game.get("id"),
        "name": game.get("name", ""),
        "slug": game.get("slug", ""),
        "description": game.get("summary") or game.get("storyline") or "",
        "background_image": image_url(cover.get("image_id"), "1080p"),
        "released": released,
        "rating": round((game.get("rating") or 0) / 20, 1),
        "platforms": platforms,
        "genres": genres,
        "developers": developers,
        "publishers": publishers,
    }


def normalize_company(company):
    logo = company.get("logo") or {}
    image = image_url(logo.get("image_id"), "logo_med")
    return {
        "id": company.get("id"),
        "name": company.get("name", ""),
        "slug": company.get("slug", ""),
        "description": company.get("description") or "",
        "image": image,
        "image_background": image,
        "rating": 0,
    }


def normalize_platform(platform):
    logo = platform.get("platform_logo") or {}
    image = image_url(logo.get("image_id"), "1080p")
    return {
        "id": platform.get("id"),
        "name": platform.get("name", ""),
        "slug": platform.get("slug", ""),
        "description": platform.get("summary") or "",
        "image_background": image,
    }


def normalize_store(store_id, name, slug):
    return {
        "id": store_id,
        "name": name,
        "slug": slug,
        "domain": "",
        "games_count": 0,
        "image_background": "",
    }


@api.route('/rawg/<path:rawg_path>', methods=['GET'])
@api.route('/igdb/<path:rawg_path>', methods=['GET'])
def proxy_igdb(rawg_path):
    allowed_resources = {'games', 'creators', 'platforms', 'stores', 'genres'}
    resource = rawg_path.split('/', 1)[0]
    if resource not in allowed_resources:
        return jsonify({"message": "Unsupported IGDB resource"}), 404

    params = request.args.to_dict(flat=True)
    limit = min(max(int(params.get('page_size', 20)), 1), 50)
    page = max(int(params.get('page', 1)), 1)
    offset = (page - 1) * limit

    try:
        if resource == 'games':
            parts = rawg_path.split('/')
            if len(parts) == 2:
                game = igdb_request("games", f"fields id,name,slug,summary,storyline,cover.image_id,first_release_date,rating,platforms.name,genres.name,involved_companies.company.name,involved_companies.developer,involved_companies.publisher; where id = {parts[1]}; limit 1;")
                if not game:
                    return jsonify({"message": "Game not found"}), 404
                return jsonify(normalize_game(game[0])), 200

            genre_slug = params.get('genres')
            where = ""
            if genre_slug:
                genre_rows = igdb_request("genres", f"fields id,name,slug; where slug = \"{genre_slug}\"; limit 1;")
                if genre_rows:
                    where = f" where genres = ({genre_rows[0]['id']});"

            if params.get('dates'):
                year_start, year_end = params['dates'].split(',')[0:2] if ',' in params['dates'] else (params['dates'], params['dates'])
                try:
                    import calendar, time
                    start = calendar.timegm(time.strptime(year_start, "%Y-%m-%d")) if '-' in year_start else int(year_start) * 0
                    end = calendar.timegm(time.strptime(year_end, "%Y-%m-%d")) if '-' in year_end else 0
                    if start and end:
                        date_where = f" where first_release_date >= {start} & first_release_date <= {end};"
                        where = date_where
                except ValueError:
                    pass

            if not params.get('dates'):
                where = where or " where first_release_date != null;"

            query = f"fields id,name,slug,summary,storyline,cover.image_id,first_release_date,rating,platforms.name,genres.name,involved_companies.company.name,involved_companies.developer,involved_companies.publisher;{where} sort first_release_date desc; limit {limit}; offset {offset};"
            games = igdb_request("games", query)
            results = [normalize_game(game) for game in games]
            return jsonify({"count": len(results), "next": None, "previous": None, "results": results}), 200

        if resource == 'creators':
            parts = rawg_path.split('/')
            if len(parts) == 2:
                companies = igdb_request("companies", f"fields id,name,slug,description,logo.image_id; where id = {parts[1]}; limit 1;")
                if not companies:
                    return jsonify({"message": "Creator not found"}), 404
                return jsonify(normalize_company(companies[0])), 200
            companies = igdb_request("companies", f"fields id,name,slug,description,logo.image_id; sort name asc; limit {limit}; offset {offset};")
            results = [normalize_company(company) for company in companies]
            return jsonify({"count": len(results), "next": None, "previous": None, "results": results}), 200

        if resource == 'platforms':
            parts = rawg_path.split('/')
            if len(parts) == 2:
                platforms = igdb_request("platforms", f"fields id,name,slug,summary,platform_logo.image_id; where id = {parts[1]}; limit 1;")
                if not platforms:
                    return jsonify({"message": "Platform not found"}), 404
                return jsonify(normalize_platform(platforms[0])), 200
            platforms = igdb_request("platforms", f"fields id,name,slug,summary,platform_logo.image_id; sort name asc; limit {limit}; offset {offset};")
            results = [normalize_platform(platform) for platform in platforms]
            return jsonify({"count": len(results), "next": None, "previous": None, "results": results}), 200

        if resource == 'stores':
            parts = rawg_path.split('/')
            stores = [
                normalize_store(1, "Steam", "steam"),
                normalize_store(2, "Epic Games Store", "epic-games-store"),
                normalize_store(3, "GOG.com", "gog"),
                normalize_store(4, "Microsoft Store", "microsoft-store"),
                normalize_store(5, "PlayStation Store", "playstation-store"),
                normalize_store(6, "Xbox Store", "xbox-store"),
                normalize_store(7, "Nintendo Store", "nintendo-store"),
            ]
            if len(parts) == 2:
                for store in stores:
                    if str(store["id"]) == parts[1]:
                        return jsonify(store), 200
                return jsonify({"message": "Store not found"}), 404
            return jsonify({"count": len(stores), "next": None, "previous": None, "results": stores}), 200

        genres = igdb_request("genres", f"fields id,name,slug; sort name asc; limit {limit}; offset {offset};")
        return jsonify({"count": len(genres), "next": None, "previous": None, "results": genres}), 200

    except ValueError as error:
        return jsonify({"message": str(error)}), 503
    except HTTPError as error:
        return jsonify({"message": "IGDB request failed", "status": error.code}), error.code
    except URLError:
        return jsonify({"message": "IGDB service is unavailable"}), 502

# Allow CORS requests to this API
CORS(api)


@api.route('/hello', methods=['POST', 'GET'])
def handle_hello():

    response_body = {
        "message": "Hello! I'm a message that came from the backend, check the network tab on the google inspector and you will see the GET request"
    }

    return jsonify(response_body), 200

# Create a route to authenticate your users and return JWTs. The
# create_access_token() function is used to actually generate the JWT.
@api.route("/token", methods=["POST"])
def create_token():
    email = request.json.get("email", None)
    password = request.json.get("password", None)
    access_token = create_access_token(identity=email)
    return jsonify(access_token=access_token)



@api.route('/signup', methods=['POST'])
def sign_up():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"message": "Username and password are required"}), 400
    
    if User.query.filter_by(username=username).first():
        return jsonify({"message": "Username already exists"}), 409
    
    hashed_password = generate_password_hash(password)
    new_user = User(username=username, password=hashed_password, is_active=True)
    db.session.add(new_user)
    db.session.commit()

    access_token = create_access_token(identity=new_user.id)
    
    return jsonify({
    "message": "User created successfully",
    "access_token": access_token
    }), 201

@api.route('/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    if not username or not password:
        return jsonify({"message": "Username and password are required"}), 400
    
    user = User.query.filter_by(username=username).first()
    if not user or not check_password_hash(user.password, password):
        return jsonify({"message": "Invalid username or password"}), 401
    
    access_token = create_access_token(identity=user.id)
    
    return jsonify({"access_token": access_token}), 200

@api.route('/logout', methods=['POST'])
@jwt_required()
def logout():
    # No need to do anything for logout with JWT
    return jsonify({"message": "Logout successful"}), 200


# ROUTES FOR FAVORITE GAMES

@api.route('/favorites/games', methods=['POST'])
@jwt_required()
def add_game_to_favorites():
    try:
        user_id = get_jwt_identity()
        data = request.json
        game_id = data.get('game_id')
        
        if not game_id:
            return jsonify({"message": "Game ID is required"}), 400
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({"message": "User not found"}), 404
        
        # Verificar si el juego ya está en la lista de favoritos del usuario
        if FavoriteGame.query.filter_by(user_id=user_id, game_id=game_id).first():
            return jsonify({"message": "Game already in favorites"}), 400
        
        # Agregar el juego a la lista de favoritos del usuario
        new_favorite = FavoriteGame(user_id=user_id, game_id=game_id)
        db.session.add(new_favorite)
        db.session.commit()
        
        return jsonify({"message": "Game added to favorites successfully"}), 201
    except Exception as e:
        return jsonify({"message": str(e)}), 500

@api.route('/favorites/games/<int:game_id>', methods=['DELETE'])
@jwt_required()
def remove_game_from_favorites(game_id):
    user_id = get_jwt_identity()
    
    user = User.query.get(user_id)
    
    # Verificar si el juego está en la lista de favoritos del usuario
    favorite_game = FavoriteGame.query.filter_by(user_id=user_id, game_id=game_id).first()
    if not favorite_game:
        return jsonify({"message": "Game not found in favorites"}), 404
    
    # Eliminar el juego de la lista de favoritos del usuario
    db.session.delete(favorite_game)
    db.session.commit()
    
    return jsonify({"message": "Game removed from favorites successfully"}), 200

@api.route('/favorites/games', methods=['GET'])
@jwt_required()
def get_user_game_favorites():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    user_game_favorites = [game.game_id for game in user.favorite_games]
    
    return jsonify(user_game_favorites), 200

#ROUTES FOR FAVORITE CREATORS

@api.route('/favorites/creators', methods=['POST'])
@jwt_required()
def add_creator_to_favorites():
    try:
        user_id = get_jwt_identity()
        data = request.json
        creator_id = data.get('creator_id')
        
        if not creator_id:
            return jsonify({"message": "Creator ID is required"}), 400
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({"message": "User not found"}), 404
        
        # Verificar si el juego ya está en la lista de favoritos del usuario
        if FavoriteCreator.query.filter_by(user_id=user_id, creator_id=creator_id).first():
            return jsonify({"message": "Creator already in favorites"}), 400
        
        # Agregar el juego a la lista de favoritos del usuario
        new_favorite = FavoriteCreator(user_id=user_id, creator_id=creator_id)
        db.session.add(new_favorite)
        db.session.commit()
        
        return jsonify({"message": "Creator added to favorites successfully"}), 201
    except Exception as e:
        return jsonify({"message": str(e)}), 500

@api.route('/favorites/creators/<int:creator_id>', methods=['DELETE'])
@jwt_required()
def remove_creator_from_favorites(creator_id):
    user_id = get_jwt_identity()
    
    user = User.query.get(user_id)
    
    # Verificar si el juego está en la lista de favoritos del usuario
    favorite_creator = FavoriteCreator.query.filter_by(user_id=user_id, creator_id=creator_id).first()
    if not favorite_creator:
        return jsonify({"message": "Creator not found in favorites"}), 404
    
    # Eliminar el juego de la lista de favoritos del usuario
    db.session.delete(favorite_creator)
    db.session.commit()
    
    return jsonify({"message": "Creator removed from favorites successfully"}), 200

@api.route('/favorites/creators', methods=['GET'])
@jwt_required()
def get_user_creator_favorites():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    user_creator_favorites = [creator.creator_id for creator in user.favorite_creators]
    
    return jsonify(user_creator_favorites), 200


# ROUTES FOR FAVORITE PLATFORMS

@api.route('/favorites/platforms', methods=['POST'])
@jwt_required()
def add_platform_to_favorites():
    try:
        user_id = get_jwt_identity()
        data = request.json
        platform_id = data.get('platform_id')
        
        if not platform_id:
            return jsonify({"message": "Platform ID is required"}), 400
        
        user = User.query.get(user_id)
        if not user:
            return jsonify({"message": "User not found"}), 404
        
        # Verificar si el juego ya está en la lista de favoritos del usuario
        if FavoritePlatform.query.filter_by(user_id=user_id, platform_id=platform_id).first():
            return jsonify({"message": "Platform already in favorites"}), 400
        
        # Agregar el juego a la lista de favoritos del usuario
        new_favorite = FavoritePlatform(user_id=user_id, platform_id=platform_id)
        db.session.add(new_favorite)
        db.session.commit()
        
        return jsonify({"message": "Platform added to favorites successfully"}), 201
    except Exception as e:
        return jsonify({"message": str(e)}), 500

@api.route('/favorites/platforms/<int:platform_id>', methods=['DELETE'])
@jwt_required()
def remove_platform_from_favorites(platform_id):
    user_id = get_jwt_identity()
    
    user = User.query.get(user_id)
    
    # Verificar si el juego está en la lista de favoritos del usuario
    favorite_platform = FavoritePlatform.query.filter_by(user_id=user_id, platform_id=platform_id).first()
    if not favorite_platform:
        return jsonify({"message": "Platform not found in favorites"}), 404
    
    # Eliminar el juego de la lista de favoritos del usuario
    db.session.delete(favorite_platform)
    db.session.commit()
    
    return jsonify({"message": "Platform removed from favorites successfully"}), 200

@api.route('/favorites/platforms', methods=['GET'])
@jwt_required()
def get_user_platform_favorites():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    
    user_platform_favorites = [platform.platform_id for platform in user.favorite_platforms]
    
    return jsonify(user_platform_favorites), 200