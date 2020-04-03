#!/usr/bin/env python

import asyncio
import json
import logging
import websockets

logging.basicConfig()

class Room(object):
    def __init__(self):
        self._users = set()

    def register(self, websocket):
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
    return json.dumps({"type": "state", **STATE})

def users_event():
    return json.dumps({"type": "users", "value": ROOM.get_user_names()})

async def notify_state():
    if ROOM._users:  # asyncio.wait doesn't accept an empty list
        message = state_event()
        await asyncio.wait([user._socket.send(message) for user in ROOM._users])

async def notify_users():
    if ROOM._users:  # asyncio.wait doesn't accept an empty list
        message = users_event()
        await asyncio.wait([user._socket.send(message) for user in ROOM._users])

async def register(websocket):
    ROOM.register(websocket)
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
            if data["action"] == "minus":
                STATE["value"] -= 1
                await notify_state()
            elif data["action"] == "plus":
                STATE["value"] += 1
                await notify_state()
            elif data["action"] == "setname":
                ROOM.set_name(websocket, data["value"])
                await notify_users()
            else:
                logging.error("unsupported event: {}", data)
    finally:
        await unregister(websocket)

start_server = websockets.serve(counter, "localhost", 6789)

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
