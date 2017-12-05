const meby = require('./meby');
const Video = require('./video.js');
const request = require('request');
const fs = require('fs');

const HTTP_PORT = 8080;
const TCP_PORT = 3030;

// app data
let seqCount = 0;
let playlist = [];
const MAX_PLAYLIST_SIZE = 24;
const INTERVAL_SECONDS = 5; 

const PLAYLIST_FILENAME = 'playlist';

// playing video, null when not playing
let currentVideo = null;
let timeout = null;
let startTime = null;

const cmdFuncs = {
    'loaded': cmdLoaded,
    'add_video': cmdAddVideo,
    'remove_video': cmdRemoveVideo,
    'skip': cmdSkip,
    'move': cmdMove,
    'on_play_complete': cmdOnPlayComplete,
    'yt_api_search': cmdYtApiSearch,
    'yt_api_videos': cmdYtApiVideos
}

// dispatch messages from app clients for each command
function onMsg(username, sid, msg) {
    let ary = meby.split(msg, ' ', 2);
    let cmd = ary[0];
    let line = ary[1];
 
    let func = cmdFuncs[cmd];
    if (func != null) {
	func(username, sid, line);
    }
}
 
function cmdLoaded(username, sid, line) {
    if (currentVideo != null) {
	let elapsedSeconds = Math.floor((new Date().getTime() - startTime) / 1000);
	meby.sendBySid(sid, 'play ' + currentVideo.videoId + ' ' + elapsedSeconds);
	meby.sendBySid(sid, 'current_seq ' + currentVideo.seq);
    } else {
	meby.sendBySid(sid, 'suspend')
    }

    for (let i = 0; i < playlist.length; i++) {
	let video = playlist[i];
	meby.sendBySid(sid, 'add_video ' + video.seq + ' ' + video.videoId + ' ' + video.played + ' ' + video.duration + ' ' + video.title);
    }
}
 
function cmdAddVideo(username, sid, line) {
    let args = meby.split(line, ' ', 3);
    let seq = seqCount;
    let videoId = args[0];
    let duration = parseInt(args[1]);
    let title = args[2];
    let video = new Video(seq, videoId, false, duration, title);
    seqCount++;

    function writeVideoData(video) {
	fs.appendFileSync(PLAYLIST_FILENAME, videoId + ' ' + duration + ' ' + title + "\n", 'utf-8', function(err) {
	    console.log(err);
	});
    }

    if (playlist.length == 0) {
	playlist.push(video)
	meby.sendAll('add_video ' + seq + ' ' + videoId + ' ' + false + ' ' + duration + ' ' + title);
	meby.sendLog(username + 'が' + title + 'を追加しました。');

	writeVideoData(video);

	currentVideo = video;
	meby.sendAll('play ' + videoId + ' ' + 0);
	meby.sendAll('current_seq ' + seq);

	startTime = new Date().getTime();
	timeout = setTimeout(function() {
	    onMsg(null, null, 'on_play_complete');
	}, (duration + INTERVAL_SECONDS) * 1000);

	return;
    }

    if (playlist.length == MAX_PLAYLIST_SIZE) {
	if (currentVideo.seq == playlist[0].seq) {
	    clearTimeout(timeout);
	    
	    let removeVideo = playlist.shift();
	    meby.sendAll('remove_video ' + removeVideo.seq);

	    currentVideo = playlist[0];
	    meby.sendAll('play ' + currentVideo.videoId + ' ' + 0);
	    meby.sendAll('current_seq ' + currentVideo.seq);

	    startTime = new Date().getTime();
	    timeout = setTimeout(function() {
		onMsg(null, null, 'on_play_complete');
	    }, (currentVideo.duration + INTERVAL_SECONDS) * 1000);

	    playlist.push(video)
	    meby.sendAll('add_video ' + seq + ' ' + videoId + ' ' + false + ' ' + duration + ' ' + title);
	    meby.sendLog(username + 'が' + title + 'を追加しました。');

	    writeVideoData(video);
	} else {
	    let removeVideo = playlist.shift();
	    meby.sendAll('remove_video ' + removeVideo.seq);

	    playlist.push(video)
	    meby.sendAll('add_video ' + seq + ' ' + videoId + ' ' + false + ' ' + duration + ' ' + title);
	    meby.sendLog(username + 'が' + title + 'を追加しました。');

	    writeVideoData(video);
	}

	return;
    }

    playlist.push(video)
    meby.sendAll('add_video ' + seq + ' ' + videoId + ' ' + false + ' ' + duration + ' ' + title);
    meby.sendLog(username + 'が' + title + 'を追加しました。');

    writeVideoData(video);
}

function cmdRemoveVideo(username, sid, line) {
    let seq = parseInt(line);

    if (currentVideo == null) {
	return;
    }

    let removeIdx = findVideoIdxBySeq(seq);
    if (removeIdx == null) {
	return;
    }

    let removeVideo = playlist[removeIdx];

    if (playlist.length >= 2 && removeVideo.seq != currentVideo.seq) {
	playlist.splice(removeIdx, 1);
	meby.sendAll('remove_video ' + seq);

	return;
    }

    if (playlist.length >= 2 && removeVideo.seq == currentVideo.seq) {
	clearTimeout(timeout);	

	let nextIdx = (removeIdx + 1) % playlist.length;
	currentVideo = playlist[nextIdx];
	meby.sendAll('play ' + currentVideo.videoId + ' 0');
	meby.sendAll('current_seq ' + currentVideo.seq);

	startTime = new Date().getTime();
	timeout = setTimeout(function() {
	    onMsg(null, null, 'on_play_complete');
	}, (currentVideo.duration + INTERVAL_SECONDS) * 1000);

	playlist.splice(removeIdx, 1);
	meby.sendAll('remove_video ' + seq);

	return;
    }

    if (playlist.length == 1 && removeVideo.seq == currentVideo.seq) {
	clearTimeout(timeout);	
	timeout = null;
	startTime = null;

	playlist.splice(removeIdx, 1);
	meby.sendAll('remove_video ' + seq);

	currentVideo = null;
	meby.sendAll('suspend')

	return;
    }
}

function cmdSkip(username, sid, line) {
    if (currentVideo == null) {
	return;
    }
    
    if (currentVideo.played == false) {
	currentVideo.played = true;
	meby.sendAll('played ' + currentVideo.seq);
    }

    clearTimeout(timeout);	

    let currentIdx = findVideoIdxBySeq(currentVideo.seq);
    if (currentIdx == null) {
	return;
    }

    let nextIdx = (currentIdx + 1) % playlist.length;
    currentVideo = playlist[nextIdx];
    meby.sendAll('play ' + currentVideo.videoId + ' 0');
    meby.sendAll('current_seq ' + currentVideo.seq);

    startTime = new Date().getTime();
    timeout = setTimeout(function() {
	onMsg(null, null, 'on_play_complete');
    }, (currentVideo.duration + INTERVAL_SECONDS) * 1000);
}

function cmdMove(username, sid, line) {
    let seq = parseInt(line);

    if (currentVideo == null) {
	return;
    }
    
    if (currentVideo.played == false) {
	currentVideo.played = true;
	meby.sendAll('played ' + currentVideo.seq);
    }

    clearTimeout(timeout);	

    let nextIdx = findVideoIdxBySeq(seq);
    if (nextIdx == null) {
	return;
    }

    currentVideo = playlist[nextIdx];
    meby.sendAll('play ' + currentVideo.videoId + ' 0');
    meby.sendAll('current_seq ' + currentVideo.seq);

    startTime = new Date().getTime();
    timeout = setTimeout(function() {
	onMsg(null, null, 'on_play_complete');
    }, (currentVideo.duration + INTERVAL_SECONDS) * 1000);
}

function cmdYtApiSearch(username, sid, line) {
    let query = line;

    request.get({
	url: "http://youtube-api:9000/search",
	qs: {
	    q: query
	}
    }, function (error, response, body) {
	result = JSON.stringify(JSON.parse(body));
	meby.sendBySid(sid, 'yt_api_search_result ' + result);
    });
}

function cmdYtApiVideos(username, sid, line) {
    let videoId = line;

    request.get({
	url: "http://youtube-api:9000/videos",
	qs: {
	    id: videoId
	}
    }, function (error, response, body) {
	result = JSON.stringify(JSON.parse(body));
	meby.sendBySid(sid, 'yt_api_videos_result ' + result);
    });
}

function cmdOnPlayComplete(username, sid, line) {
    if (playlist.length == 0) {
	return;
    }

    if (currentVideo == null) {
	return;
    }

    if (currentVideo.played == false) {
	currentVideo.played = true;
	meby.sendAll('played ' + currentVideo.seq)
    }

    let currentIdx = findVideoIdxBySeq(currentVideo.seq);
    if (currentIdx == null) {
	return;
    }

    let nextIdx = (currentIdx + 1) % playlist.length;
    currentVideo = playlist[nextIdx];
    meby.sendAll('play ' + currentVideo.videoId + ' 0');
    meby.sendAll('current_seq ' + currentVideo.seq);

    startTime = new Date().getTime();
    timeout = setTimeout(function() {
	onMsg(null, null, 'on_play_complete');
    }, (currentVideo.duration + INTERVAL_SECONDS) * 1000);
}

function findVideoIdxBySeq(seq) {
    for (let i = 0; i < playlist.length; i++) {
	if (playlist[i].seq == seq) {
	    return i;
	}
    }

    return null;
}

function loadPlaylist(filename) {
    let text;
    try {
	text = fs.readFileSync(filename, 'utf8');
    } catch (e) {
	console.log(e.message);
	return;
    }

    let lines = text.split('\n');
    lines.pop();

    if (lines.length > MAX_PLAYLIST_SIZE) {
	lines.splice(0, lines.length - MAX_PLAYLIST_SIZE);
    }

    for (let line of lines) {
	let ary = meby.split(line, ' ', 3);
	let videoId = ary[0];
	let duration = parseInt(ary[1]);
	let title = ary[2];
	let seq = seqCount;
	seqCount++;

	let video = new Video(seq, videoId, false, duration, title);
	playlist.push(video);
    }

    if (playlist.length > 0) {
	currentVideo = playlist[0];
	
	startTime = new Date().getTime();
	timeout = setTimeout(function() {
	    onMsg(null, null, 'on_play_complete');
	}, (currentVideo.duration + INTERVAL_SECONDS) * 1000);
    }
}

function main() {
    if (process.argv.length >= 3) {
	let filename = process.argv[2];
	loadPlaylist(filename);
    }

    meby.startWebServer(HTTP_PORT);
    
    meby.setMsgFunction(onMsg);
    meby.startAppServer(TCP_PORT);
}

main();
