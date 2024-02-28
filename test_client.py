import json

from websockets.sync.client import connect
import requests
import socketio
import asyncio


def testRest():
    host = "https://hono-cf-proxy.linnil1.me"
    host = "http://localhost:8787"

    # basic proxy
    rep = requests.get(host + "/basic/get")
    print(rep.json())

    # auth proxy
    url = host + "/auth_kv"
    rep = requests.get(url + "/init?group=group1")
    token = rep.json()["token"]
    print(token)
    rep = requests.get(url, headers={"Authorization": f"Bearer {token}"})
    print(rep.json())


def testWebsocket():
    url = "ws://localhost:5000/websocket"  # target
    url = "wss://echo.websocket.org"  # other-hosted target
    host = "wss://hono-cf-proxy.linnil1.me"
    host = "ws://localhost:8787"
    url = host + "/websocket"  # proxy by fetch
    url = host + "/websocket_server"  # websocket on worker
    url = host + "/websocket_proxy"  # websocket on worker and proxy to target
    with connect(url) as websocket:
        for i in range(5):
            print("Client Send", {"send": i})
            websocket.send(json.dumps({"send": i}))
            data = websocket.recv()
            print(f"Client Received: {data}")


def testSocketIO():
    # sio = socketio.Client(logger=True, engineio_logger=True)
    sio = socketio.Client()
    url, path = "http://localhost:5000", "/socketio"  # target
    url, path = "http://localhost:8787", "/socketio"  # proxy by fetch
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
    print("GO TO https://socketio-chat-h9jt.herokuapp.com to test some message")
    # sio = socketio.Client(logger=True, engineio_logger=True)
    sio = socketio.AsyncClient()
    url, path = "https://socketio-chat-h9jt.herokuapp.com", "socket.io"
    url, path = "https://hono-cf-proxy.linnil1.me", "/socketio/socket.io"
    url, path = "http://localhost:8787", "/socketio/socket.io"
    await sio.connect(url, socketio_path=path, transports="websocket")
    print("Send:", "Add WebsocketTester")
    await sio.emit("add user", "WebsocketTester")
    print("Send:", "OK")
    await sio.emit("new message", "OK")

    @sio.on("*")
    async def handle_event(event, *args):
        data = args[0]
        print("Receive:", event, args)
        if "username" in data and event == "new message":
            print("Send:", f"Hello {data['username']}!")
            await sio.emit("new message", f"Hello {data['username']}!")

    while True:
        await asyncio.sleep(3)
        await sio.emit("typing", "")
        await asyncio.sleep(3)
        await sio.emit("stop typing", "")


if __name__ == "__main__":
    # testRest()
    # testWebsocket()
    # testSocketIO()
    asyncio.run(testChatRoom())
