from flask import Flask, request, jsonify
from werkzeug.exceptions import HTTPException
import json

app = Flask(__name__)
HTTP_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'CONNECT', 'OPTIONS', 'TRACE', 'PATCH']

@app.route('/', defaults={'path': '/'}, methods=HTTP_METHODS)
@app.route('/<path:path>', methods=HTTP_METHODS)
def hello_world(path):
    return jsonify({
        'method': request.method,
        'query': request.args,
        'body': request.stream.read().decode(),
        'form': request.form,
        'json': request.get_json(silent=True),
        'headers': dict(request.headers),
        'url': request.url,
        'path': request.path,
    }), 200, {"more_headers": "more_headers"}


@app.errorhandler(HTTPException)
def handle_exception(e):
    """Return JSON instead of HTML for HTTP errors."""
    # start with the correct headers and status code from the error
    response = e.get_response()
    # replace the body with JSON
    response.data = json.dumps({
        "code": e.code,
        "name": e.name,
        "description": e.description,
    })
    response.content_type = "application/json"
    return response


if __name__ == "__main__":
    app.run(debug=True, port=5000)