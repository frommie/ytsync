#!/usr/bin/env python

import time
from .user import User

class Room(object):
    def __init__(self):
        self._users = set()
        self._update = 0
        self._video_id = 'PuFrndeuzj0'
        self._last_timestamp = 0
        self._last_update = 0
        self._state = 2
        self._leader = None
        self._max_user_id = 0

    def register(self, websocket):
        name = 'guest' + str(self._max_user_id)
        self._max_user_id += 1
        if len(self._users) == 0:
            self._leader = websocket
        self._users.add(User(websocket, name))
        return

    def update(self, event):
        self.set_video(event["target"]["playerInfo"]["videoData"]["video_id"])
        self.set_time(event["target"]["playerInfo"]["currentTime"])
        self.set_state(event["data"])
        self._last_update = time.time()

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

    def set_leader(self, name):
        for user in self._users:
            if user._name == name:
                self._leader = user._socket

    def get_user_names(self):
        names = []
        leader = ''
        for user in self._users:
            names.append(user._name)
            if self._leader == user._socket:
                leader = user._name
        return {
            "names": names,
            "leader": leader
        }

    def get_state(self):
        video_time = 0
        if self._last_update > 0:
            video_time = self._last_timestamp + (time.time() - self._last_update)
        return {
            "video_id": self._video_id,
            "timestamp": video_time,
            "state": self._state
        }
