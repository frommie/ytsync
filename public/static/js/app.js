var websocket = new WebSocket("wss://watch.frommert.eu:6789"),
//var websocket = new WebSocket("ws://localhost:6789"),
    tag = document.createElement('script'),
    vidurl = '',
    player,
    firstScriptTag = document.getElementsByTagName('script')[0],
    sync_secs = 0,
    name = ''
    leading = false,
    paused = false;

tag.src = "https://www.youtube.com/iframe_api";
firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

document.getElementById("nickname").onkeypress = function(event) {
  if (event.keyCode == 13 || event.which == 13) {
    set_nickname();
  }
};

document.getElementById("video_id").onkeypress = function(event) {
  if (event.keyCode == 13 || event.which == 13) {
    set_video();
  }
};


// init youtube player
function onYouTubeIframeAPIReady() {
  player = new YT.Player('player', {
    height: '100%',
    width: '100%',
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
  console.log(event);
  if (event.data == 2) {
    console.log("paused");
    paused = true;
  } else {
    paused = false;
  }
  if (leading) {
    sync_to_server(event);
  } else {
    if (!paused) { // allow pause
      console.log("sync!");
      var event = {
        action: 'getsync'
      };
      websocket.send(JSON.stringify(event));
    }
  }
}

function update_player(data) {
  if (vidurl != data["video_id"]) {
    vidurl = data["video_id"];
    player.loadVideoById(vidurl, data["timestamp"]+sync_secs);
  } else {
    // get current timestamp
    // compare state
    console.log("test");
    console.log(paused);
    if (data["state"] != player.getPlayerState() && !paused) {
      switch (data["state"]) {
        case 1:
          player.playVideo();
          player.seekTo(data["timestamp"]+sync_secs, 1);
          break;
        case 2:
          console.log(data);
          player.pauseVideo();
          break;
      }
    } else {
      if (Math.abs(data["timestamp"] - player.getCurrentTime()) > 1 && !paused) {
        player.seekTo(data["timestamp"]+sync_secs, 1);
      }
    }
  }
}

// websocket functions
websocket.onmessage = function (event) {
  data = JSON.parse(event.data);
  switch (data.type) {
    case 'register':
      // receive own name
      name = data["value"]
      $('#nickname')[0].placeholder = "Name: "+name;
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
  // seek leader index
  var leader_index = 0;
  for (i = 0; i < arr.names.length; i++) {
    if (arr.names[i] == arr.leader) {
      leader_index = i;
      break;
    }
  }
  $('#videoinput-box').hide();
  if (name == arr.names[leader_index]) {
    // we are the leader
    leading = true;
    $('#videoinput-box').show();
  }

  var html = "<ul class=\"chat-list\">";

  for (i = 0; i < arr.names.length; i++) {
    html += "<li><span class=\"clist-1\">";
    if (arr.leader == arr.names[i]) {
      html += "<i data-feather=\"star\"></i></span>";
    }
    html += "</span>";
    if (leading) {
      html += "<a href=\"#\" data-toggle=\"popover\" data-content=\"<a href='#' class='makeleader' id='"+arr.names[i]+"'>Make Leader</a>\">";
    }

    if (arr.names[i] == name) {
      html += "<b>";
    }
    html += arr.names[i];
    if (arr.names[i] == name) {
      html += "</b>";
    }
    if (leading) {
      html += '</a>';
    }
    html += "</li>";
  }
  html += "</ul>";
  document.getElementById("users").innerHTML = html;
  feather.replace();
  $(document).ready(function(){
    $('[data-toggle="popover"]').popover({
      placement : 'right',
      trigger: 'focus',
      html : true,
      title : 'User Info'
    });
    $(document).on("click", ".popover .makeleader" , function() {
      make_leader($(this)[0].id);
    });
  });
}

function set_nickname() {
  name = document.getElementById("nickname").value;
  var event = {
    action: 'setname',
    value: name
  };
  websocket.send(JSON.stringify(event));
  document.getElementById("nickname-box").innerHTML = "<b>"+name+"</b>";
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
