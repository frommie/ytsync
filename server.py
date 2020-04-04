#!/usr/bin/env python

import asyncio
import json
import logging
import pathlib
import ssl
import websockets

logging.basicConfig()

class Room(object):
    def __init__(self):
        self._users = set()
        self._update = 0
        self._video_id = ''
        self._last_timestamp = 0
        self._state = -1
        self._leader = None

    def register(self, websocket):
        if len(self._users) == 0:
            self._leader = websocket
        self._users.add(User(websocket))
        return

    def unregister(self, websocket):
        for user in self._users:
            if user._socket == websocket:
                self._users.remove(user)
                break
        return

    def set_name(self, websocket, name):
        for user in self._users:
            if user._socket == websocket:
                user.set_name(name)
                break
        return

    def get_user_names(self):
        names = []
        for user in self._users:
            if user._name != '':
                names.append(user._name)
        return names

    def set_video(self, video_id):
        if self._video_id != video_id:
            self._video_id = video_id
            self._update = 1

    def set_time(self, timestamp):
        if self._last_timestamp != timestamp:
            self._last_timestamp = timestamp
            self._update = 1

    def set_state(self, state):
        # 1 = playing
        # 2 = pause
        if self._state != state:
            self._state = state
            self._update = 1

    def get_state(self):
        return {
            "video_id": self._video_id,
            "timestamp": self._last_timestamp,
            "state": self._state
        }

class User(object):
    def __init__(self, websocket):
        self._socket = websocket
        self._name = ''

    def set_name(self, name):
        self._name = name
        return


STATE = {"value": 0}

ROOM = Room()

def state_event():
    return json.dumps({"type": "state", "value": ROOM.get_state()})

def users_event():
    return json.dumps({"type": "users", "value": ROOM.get_user_names()})

async def notify_state(websocket):
    if ROOM._users:  # asyncio.wait doesn't accept an empty list
        message = state_event()
        await asyncio.wait([user._socket.send(message) for user in list(filter(lambda x: x._socket != websocket, ROOM._users))])

async def notify_users():
    if ROOM._users:  # asyncio.wait doesn't accept an empty list
        message = users_event()
        await asyncio.wait([user._socket.send(message) for user in ROOM._users])

async def handle_sync(websocket, event):
    if ROOM._leader = websocket:
        if event["target"]["playerInfo"]["videoData"]["video_id"]:
            ROOM.set_video(event["target"]["playerInfo"]["videoData"]["video_id"])
            ROOM.set_time(event["target"]["playerInfo"]["currentTime"])
            ROOM.set_state(event["data"])
            if ROOM._update:
                await notify_state(websocket)

async def register(websocket):
    ROOM.register(websocket)
    print("new user")
    await notify_users()


async def unregister(websocket):
    ROOM.unregister(websocket)
    await notify_users()

async def counter(websocket, path):
    # register(websocket) sends user_event() to websocket
    await register(websocket)
    try:
        await websocket.send(state_event())
        async for message in websocket:
            data = json.loads(message)
            if data["action"] == "setname":
                ROOM.set_name(websocket, data["value"])
                await notify_users()
            elif data["action"] == "sync":
                await handle_sync(websocket, data["value"])
            else:
                logging.error("unsupported event: {}", data)
    finally:
        await unregister(websocket)

ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
localhost_pem = pathlib.Path(__file__).with_name("key.pem")
ssl_context.load_cert_chain(localhost_pem)

start_server = websockets.serve(
    counter,
    "watch.frommert.eu",
    6789,
    ssl=ssl_context
)

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
