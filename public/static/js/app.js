var websocket = new WebSocket("wss://watch.frommert.eu:6789"),
//var websocket = new WebSocket("ws://localhost:6789"),
    tag = document.createElement('script'),
    vidurl = '',
    player,
    firstScriptTag = document.getElementsByTagName('script')[0];

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
  console.log("update!");
  sync_to_server(event);
}

function update_player(data) {
  if (vidurl != data["video_id"]) {
    vidurl = data["video_id"];
    player.loadVideoById(vidurl, data["timestamp"]+2);
  } else {
    // get current timestamp
    // compare state
    if (data["state"] != player.getPlayerState()) {
      switch (data["state"]) {
        case 1:
          console.log("play");
          player.playVideo();
          player.seekTo(data["timestamp"], 1);
          break;
        case 2:
          player.pauseVideo();
          break;
      }
    } else {
      if (Math.abs(data["timestamp"] - player.getCurrentTime()) > 1) {
        console.log("seek");
        player.seekTo(data["timestamp"], 1);
      }
    }
  }
}

// websocket functions
websocket.onmessage = function (event) {
  data = JSON.parse(event.data);
  console.log(data);
  switch (data.type) {
    case 'state':
      // update player
      update_player(data["value"])
      break;
    case 'users':
      document.getElementById("users").innerHTML = data.value;
      break;
    default:
      console.error("unsupported event", data);
  }
};

function set_nickname() {
  var name = document.getElementById("nickname").value;
  var event = {
    action: 'setname',
    value: name
  };
  websocket.send(JSON.stringify(event));
  document.getElementById("nickname").disabled = 1;
}

function set_video(video_id) {
  var video_id = document.getElementById("video_id").value;
  vidurl = video_id;
  if (vidurl) {
    player.loadVideoById(vidurl);
  }
}
