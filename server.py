#!/usr/bin/env python

import asyncio
import json
import logging
import pathlib
import ssl
import websockets
import argparse

from classes.room import Room
from classes.user import User

parser = argparse.ArgumentParser(description='Websocket server to sync youtube videos.')
parser.add_argument("--host", help="Hostname for serving", default="localhost")

args = parser.parse_args()

logging.basicConfig()

ROOM = Room()

def state_event():
    return json.dumps({"type": "state", "value": ROOM.get_state()})

def users_event():
    return json.dumps({"type": "users", "value": ROOM.get_user_names()})

async def notify_state(websocket):
    if len(ROOM._users) > 1:
        message = state_event()
        await asyncio.wait([user._socket.send(message) for user in list(filter(lambda x: x._socket != websocket, ROOM._users))])
    ROOM._update = 0

async def send_state(websocket):
    message = state_event()
    await asyncio.wait([websocket.send(message)])

async def notify_users(websocket):
    if len(ROOM._users) > 1:
        message = users_event()
        await asyncio.wait([user._socket.send(message) for user in list(filter(lambda x: x._socket != websocket, ROOM._users))])

async def receive_sync(websocket, event):
    if ROOM._leader == websocket:
        if event["target"]["playerInfo"]["videoData"]["video_id"]:
            ROOM.update(event)
            if ROOM._update:
                await notify_state(websocket)

async def register(websocket):
    ROOM.register(websocket)
    await notify_users(websocket)

async def unregister(websocket):
    ROOM.unregister(websocket)
    await notify_users(websocket)

async def main(websocket, path):
    # register(websocket) sends user_event() to websocket
    await register(websocket)
    try:
        async for message in websocket:
            data = json.loads(message)
            if data["action"] == "setname":
                ROOM.set_name(websocket, data["value"])
                await notify_users()
            elif data["action"] == "sync":
                await receive_sync(websocket, data["value"])
            elif data["action"] == "getsync":
                await send_state(websocket)
            else:
                logging.error("unsupported event: {}", data)
    finally:
        await unregister(websocket)

ssl_context = None
if args.host != "localhost":
    ssl_context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    localhost_pem = pathlib.Path(__file__).with_name("key.pem")
    ssl_context.load_cert_chain(localhost_pem)

start_server = websockets.serve(
    main,
    args.host,
    6789,
    ssl=ssl_context
)

asyncio.get_event_loop().run_until_complete(start_server)
asyncio.get_event_loop().run_forever()
