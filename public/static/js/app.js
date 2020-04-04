var websocket = new WebSocket("wss://watch.frommert.eu:6789"),
//var websocket = new WebSocket("ws://localhost:6789"),
    tag = document.createElement('script'),
    vidurl = '',
    player,
    firstScriptTag = document.getElementsByTagName('script')[0],
    sync_secs = 0;

tag.src = "https://www.youtube.com/iframe_api";
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

// init youtube player
function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    height: '600',
    width: '800',
    videoId: vidurl,
    events: {
      'onReady': onPlayerReady,
      'onStateChange': onPlayerStateChange
    }
  });
}

function sync_to_server(event) {
  // send current video url, state and seconds to all users
  var event = {
    action: 'sync',
    value: event
  };
  websocket.send(JSON.stringify(event));
}

// youtube functions
function onPlayerReady(event) {
  player.mute()
  // get current video from server
  var event = {
    action: 'getsync'
  };
  websocket.send(JSON.stringify(event));
}

function onPlayerStateChange(event) {
  sync_to_server(event);
}

function update_player(data) {
  if (vidurl != data["video_id"]) {
    vidurl = data["video_id"];
    player.loadVideoById(vidurl, data["timestamp"]+sync_secs);
  } else {
    // get current timestamp
    // compare state
    if (data["state"] != player.getPlayerState()) {
      switch (data["state"]) {
        case 1:
          player.playVideo();
          player.seekTo(data["timestamp"]+sync_secs, 1);
          break;
        case 2:
          player.pauseVideo();
          break;
      }
    } else {
      if (Math.abs(data["timestamp"] - player.getCurrentTime()) > 1) {
        player.seekTo(data["timestamp"]+sync_secs, 1);
      }
    }
  }
}

// websocket functions
websocket.onmessage = function (event) {
  data = JSON.parse(event.data);
  switch (data.type) {
    case 'state':
      // update player
      update_player(data["value"])
      break;
    case 'users':
      update_names(data.value);
      break;
    default:
      console.error("unsupported event", data);
  }
};

function update_names(arr) {
  var html = "<ul>";
  for (i = 0; i < arr.names.length; i++) {
    html += "<li>";
    if (arr.leader == arr.names[i]) {
      html += "L ";
    }
    html += arr.names[i];
    if (arr.leader != arr.names[i]) {
      html += ' <a href="#" onClick="make_leader(\''+arr.names[i]+'\')">X</a>';
    }
    html += "</li>";
  }
  html += "</ul>";
  document.getElementById("users").innerHTML = html;
}

function set_nickname() {
  var name = document.getElementById("nickname").value;
  var event = {
    action: 'setname',
    value: name
  };
  websocket.send(JSON.stringify(event));
  document.getElementById("nickname").disabled = 1;
}

function make_leader(name) {
  var event = {
    action: 'makeleader',
    value: name
  };
  websocket.send(JSON.stringify(event));
}

function set_video(video_id) {
  var video_id = document.getElementById("video_id").value;
  vidurl = video_id;
  if (vidurl) {
    player.loadVideoById(vidurl);
  }
}
