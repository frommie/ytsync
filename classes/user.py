#!/usr/bin/env python

class User(object):
    def __init__(self, websocket, name):
        self._socket = websocket
        self._name = name

    def set_name(self, name):
        self._name = name
        return
