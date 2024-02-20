import json

from websockets.sync.client import connect
import requests
import socketio
import asyncio


def testRest():
    host = "http://localhost:8787/app6"
    rep = requests.get(host + "/init")
    token = rep.json()["token"]
    print(token)
    rep = requests.get(host, headers={"Authorization": f"Bearer {token}"})
    print(rep.json())

    rep = requests.get("http://localhost:8787/app1")
    print(rep.json())


def testWebsocket():
    url = "ws://localhost:5000/websocket"  # target
    url = "wss://echo.websocket.org"  # other-hosted target
    url = "ws://localhost:8787/app16"  # websocket on worker
    url = "ws://localhost:8787/app17"  # websocket on worker and proxy to target
    url = "ws://localhost:8787/app1/websocket"  # proxy by fetch
    with connect(url) as websocket:
        for i in range(5):
            websocket.send(json.dumps({"send": i}))
            data = websocket.recv()
            print(f"Client Received: {data}")


def testSocketIO():
    # sio = socketio.Client(logger=True, engineio_logger=True)
    sio = socketio.Client()
    url, path = "http://localhost:5000", "/socketio"  # target
    url, path = "http://localhost:8787", "/app1/socketio"  # proxy by fetch
    url, path = "http://localhost:8787", "/app18"  # not work
    sio.connect(url, socketio_path=path, transports="websocket")
    for i in range(5):
        sio.emit("req", {"send": i})

    k = 0

    @sio.on("rep")
    def my_message(data):
        print(f"Client Received: {data}")
        nonlocal k
        k += 1
        if k == 5:
            sio.disconnect()

    sio.wait()


async def testChatRoom():
    # sio = socketio.Client(logger=True, engineio_logger=True)
    sio = socketio.AsyncClient()
    url, path = "https://socketio-chat-h9jt.herokuapp.com", "socket.io"
    url, path = "http://localhost:8787", "/app15-1/socket.io"
    await sio.connect(url, socketio_path=path, transports="websocket")
    await sio.emit("add user", "WebsocketTester")
    await sio.emit("new message", "OK")
    print("GO TO https://socketio-chat-h9jt.herokuapp.com to test some message")

    @sio.on("*")
    async def handle_event(event, *args):
        data = args[0]
        print(event, args)
        if "username" in data and event == "new message":
            await sio.emit("new message", f"Hello {data['username']}!")

    while True:
        await asyncio.sleep(3)
        await sio.emit("typing", "")
        await asyncio.sleep(3)
        await sio.emit("stop typing", "")


# testRest()
# testWebsocket()
# testSocketIO()
asyncio.run(testChatRoom())
