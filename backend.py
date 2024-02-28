import os
import requests
from typing import Union
from fastapi import FastAPI, Request, WebSocket
from fastapi.responses import StreamingResponse
from fastapi_socketio import SocketManager

HTTP_METHODS = [
    "GET",
    "HEAD",
    "POST",
    "PUT",
    "DELETE",
    "CONNECT",
    "OPTIONS",
    "TRACE",
    "PATCH",
]
app = FastAPI()
app_socketio = SocketManager(
    app=app, mount_location="/socketio", socketio_path="socketio"
)


# an endpoint that return image
@app.get("/image")
@app.get("/image/png")
async def getImage():
    filename = "Github_logo.png"
    if not os.path.exists(filename):
        with open(filename, "wb") as f:
            f.write(
                requests.get(
                    "https://github.githubassets.com/assets/GitHub-Mark-ea2971cee799.png"
                ).content
            )
    return StreamingResponse(content=open(filename, "rb"), media_type="image/png")


@app.api_route("/{path_name:path}", methods=HTTP_METHODS)
async def echoReq(path_name: str, request: Request):
    json = {}
    try:
        json = await request.json()
    except:
        pass
    return {
        "method": request.method,
        "client": request.client,
        "path": "/" + path_name,
        "headers": dict(request.headers),
        "query_params": dict(request.query_params),
        "body": await request.body(),
        "json": json,
    }


@app.websocket("/websocket")
async def echoWebsocket(websocket: WebSocket):
    await websocket.accept()
    while True:
        data = await websocket.receive_json()
        await websocket.send_json(
            {
                "server": "fastapi_websocket",
                "request": data,
            }
        )

# socketio
@app.sio.on("req")
async def echoSocketio(sid, args, **kwargs):
    data = {"args": args, "kwargs": kwargs}
    await app.sio.emit("rep", data)


#  uvicorn main:app --reload --port 5000
