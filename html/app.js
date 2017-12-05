// send message to user app server
function send(msg) {
    window.parent.postMessage('TO_USER_SERVER ' + msg, '*');
}

function receiveMessage(event) {
    onMsg(event.data);
}

class Video {
    constructor(seq, videoId, played, duration, title) {
	this.seq = seq;
	this.videoId = videoId;
	this.played = played;
	this.duration = duration;
	this.title = title;
    }
}

class SearchResult {
    constructor(idx, videoId, title) {
	this.idx = idx;
	this.videoId = videoId;
	this.title = title;
    }
}

let playlist = [];
let currentSeq = null;
let searchResults = [];
let prevQuery = '';

function iso8601Seconds(str) {
    let regexp = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/;
    if (!regexp.test(str)) {
	return -1;
    }

    let matches = regexp.exec(str);
    let h = matches[1] ? parseInt(matches[1], 10) : 0;
    let m = matches[2] ? parseInt(matches[2], 10) : 0;
    let s = matches[3] ? parseInt(matches[3], 10) : 0;
    let duration = h * 3600 + m * 60 + s;

    return duration;
}

function attachDetail(result) {
    let json = JSON.parse(result);
    if (json.items.length == 0) {
	return;
    }

    let videoId = json.items[0].id;
    let sr = searchResults.find(s => s.videoId == videoId);
    if (sr == null) {
	return;
    }

    let duration = iso8601Seconds(json.items[0].contentDetails.duration);

    $('#result' + sr.idx + 'duration').html(duration);

    $('#result' + sr.idx + 'button').click(
	{videoId: videoId, duration: duration, title: sr.title},
        function(event) {
	    let data = event.data;
	    send('add_video ' + data.videoId + ' ' + data.duration + ' ' + data.title);
	}
    );
}

function listSearchResult(result) {
    $('#search_result').html('');
    searchMode();

    searchResults = [];

    let json = JSON.parse(result);
    for (let i = 0; i < json['items'].length; i++) {
	let item = json['items'][i];
	let title = item['snippet']['title'];
	let videoId = item['id']['videoId'];
	if (videoId == undefined) {
	    continue;
	}
	let imgUrl = 'https://i.ytimg.com/vi/' + videoId + '/default.jpg';
	
	let result = $('<div>')
	    .attr('id', 'result' + i)
	    .addClass('result');

	result.append(
	    $('<div>')
		.attr('id', 'result' + i + 'img')
		.addClass('result_img')
		.html('<img src="' + imgUrl + '" width="120">'),
	    $('<div>')
		.attr('id', 'result' + i + 'title')
		.addClass('result_title')
	        .text(title),
	    $('<div>')
		.attr('id', 'result' + i + 'duration')
		.addClass('result_duration'),
	    $('<button>')
		.attr('id', 'result' + i + 'button')
		.addClass('result_button')
		.html('<div class="button_icon" style="background-image: url(img/plus.png);"></div><div class="button_label">add</div>'));

	$('#search_result').append(result);
	
	searchResults.push(new SearchResult(i, videoId, title));

	send('yt_api_videos ' + videoId);
    }
}

function addThumbnail(seq, videoId, played, duration, title) {
    let imgUrl = 'https://i.ytimg.com/vi/' + videoId + '/default.jpg';

    let backgroundColor;
    if (currentSeq == seq) {
	backgroundColor = '#ff8000';
    } else {
	if (played == true) {
	    backgroundColor = '#303030';
	} else {
	    backgroundColor = '#2080e0';
	}
    }

    $('#playlist').append(
	$('<div>')
	    .attr('id', 'video' + seq)
	    .addClass('video'));
    
    $('#video' + seq)
	.css('background-color', backgroundColor)
	.append(
	    $('<div>')
		.attr('id', 'video' + seq + 'thumbnail')
		.addClass('video_thumbnail')
		.html('<img src="' + imgUrl +'" width="140">'),
	    $('<div>')
		.attr('id', 'video' + seq + 'number')
		.addClass('video_number')
		.append(seq));

    $('#video' + seq).click(
	function() {
	    let videoImg = 'https://i.ytimg.com/vi/' + videoId + '/hqdefault.jpg';

	    $('body').append(
		$('<div>')
		    .attr('id', 'modal_filter')
		    .addClass('modal_filter'));

	    let dialog = $('<div>')
		.attr('id', 'video' + seq + 'dialog')
		.addClass('video_dialog');

	    dialog.append(
		$('<div>').html('<img src="' + videoImg + '" width="480" height="360" class="dialog_img">'),
		$('<div>').text(title),
		$('<div>').text(duration),
		$('<button>')
		    .attr('id', 'video' + seq + 'move')
		    .addClass('dialog_move_button')
		    .addClass('menu_button')
		    .html('<div class="button_icon" style="background-image: url(img/play_this.png);"></div><div class="button_label">play</div>'),
		$('<button>')
		    .attr('id', 'video' + seq + 'youtube')
		    .addClass('dialog_youtube_button')
		    .addClass('menu_button')
		    .html('<div class="button_icon" style="background-image: url(img/youtube.png);"></div><div class="button_label">youtu</div>'),
		$('<button>')
		    .attr('id', 'video' + seq + 'remove')
		    .addClass('dialog_remove_button')
		    .addClass('menu_button')
		    .html('<div class="button_icon" style="background-image: url(img/trashcan.png);"></div><div class="button_label">delete</div>'),
		$('<button>')
		    .attr('id', 'video' + seq + 'close')
		    .addClass('dialog_close_button')
		    .addClass('menu_button')
		    .html('<div class="button_icon" style="background-image: url(img/close.png);"></div><div class="button_label">close</div>'));
	    $('body').append(dialog);

	    $('#video' + seq + 'move').click(
		function() {
		    send('move ' + seq);
		    $('#modal_filter').remove();
		    $('#video' + seq + 'dialog').remove();
		}
	    );

	    $('#video' + seq + 'youtube').click(
		function() {
		    window.open('https://www.youtube.com/watch?v=' + videoId);
		    $('#modal_filter').remove();
		    $('#video' + seq + 'dialog').remove();
		}
	    );

	    $('#video' + seq + 'remove').click(
		function() {
		    send('remove_video ' + seq);
		    $('#modal_filter').remove();
		    $('#video' + seq + 'dialog').remove();
		}
	    );

	    $('#video' + seq + 'close').click(
		function() {
		    $('#modal_filter').remove();
		    $('#video' + seq + 'dialog').remove();
		}
	    );

	    $('#modal_filter').click(
		function() {
		    $('#modal_filter').remove();
		    $('#video' + seq + 'dialog').remove();
		}
	    );
	}
    );
}

function deleteThumbnail(seq) {
    $('#video' + seq).remove();
    
    let idx = -1;
    for (let i = 0; i < playlist.length; i++) {
	if (playlist[i].seq == seq) {
	    idx = i;
	    break;
	}
    }

    playlist.splice(idx, 1);
}

function cmdPlay(line) {
    let ary = line.split(' ');
    let videoId = ary[0];
    let offset = parseInt(ary[1]);
    let src = 'https://www.youtube.com/embed/' + videoId + '?autoplay=1&start=' + offset;
    $('#player').removeAttr('src');
    $('#player').attr('src', src);
}

function cmdSuspend(line) {
    $('#player').removeAttr('src');
}

function cmdAddVideo(line) {
    let ary = line.split(' ');
    let seq = parseInt(ary[0]);
    let videoId = ary[1];
    let played = ary[2] == 'true' ? true : false;
    let duration = parseInt(ary[3]);

    let len = 0;
    for (let i = 0; i < 4; i++) {
	len += ary[i].length + 1;
    }
    let title = line.substring(len);

    playlist.push(new Video(seq, videoId, played, duration, title));
    addThumbnail(seq, videoId, played, duration, title);
}

function cmdRemoveVideo(line) {
    let ary = line.split(' ');
    let seq = parseInt(ary[0]);

    deleteThumbnail(seq);
}

function cmdPlayed(line) {
    let ary = line.split(' ');
    let seq = parseInt(ary[0]);

    $('#video' + seq).css('background-color', '#303030');

    for (let i = 0; i < playlist.length; i++) {
	if (playlist[i].seq == seq) {
	    playlist[i].played = true;
	}
    }
}

function cmdCurrentSeq(line) {
    let ary = line.split(' ');
    let prevSeq = currentSeq;
    currentSeq = parseInt(ary[0]);

    for (let i = 0; i < playlist.length; i++) {
	if (playlist[i].seq == prevSeq) {
	    let played = playlist[i].played;
	    if (played == true) {
		$('#video' + prevSeq).css('background-color', '#303030');
	    } else {
		$('#video' + prevSeq).css('background-color', '#2080e0');
	    }
	    break;
	}
    }

    $('#video' + currentSeq).css('background-color', '#ff8000');
}

const cmdFuncs = {
    'play': cmdPlay,
    'suspend': cmdSuspend,
    'add_video': cmdAddVideo,
    'remove_video': cmdRemoveVideo,
    'played': cmdPlayed,
    'current_seq': cmdCurrentSeq,
    'yt_api_search_result': listSearchResult,
    'yt_api_videos_result': attachDetail
};

// dispatch messages from server
function onMsg(msg) {
    let ary = split(msg, ' ', 2);
    let cmd = ary[0];
    let arg = ary[1];

    let func = cmdFuncs[cmd];
    if (func != null) {
	func(arg);
    }
}

function playMode() {
    $('#video').css({
	display: 'block',
	width: 800 + 'px',
	height: 550 + 'px',
        left: 0 + 'px',
        top: 0 + 'px',
        transform: 'scale(1.0, 1.0)',
	'pointer-events': 'auto'});
    $('#player').attr({
	width: 800,
	height: 450});
    $('#playlist').css({
	display: 'none',
	width: 0,
	height: 0});
    $('#search').css({
	display: 'none',
	width: 0,
	height: 0});
}

function playlistMode() {
    $('#video').css({
	display: 'none',
	width: 0,
	height: 0,
        left: 0 + 'px',
        top: 0 + 'px',
        transform: 'scale(1.0, 1.0)',
	'pointer-events': 'auto'});
    $('#player').attr({
	width: 0,
	height: 0});
    $('#playlist').css({
	display: 'block',
	width: 800 + 'px',
	height: 550 + 'px'});
    $('#search').css({
	display: 'none',
	width: 0,
	height: 0});
}

function searchMode() {
    $('#video').css({
	display: 'block',
	width: 800 + 'px',
	height: 550 + 'px',
        left: 250 + 'px',
        top: 180 + 'px',
        transform: 'scale(0.3, 0.3)',
	'pointer-events': 'none'});
    $('#player').attr({
	width: 0,
	height: 0});
    $('#playlist').css({
	display: 'none',
	width: 0,
	height: 0});
    $('#search').css({
	display: 'block',
	width: 800 + 'px',
	height: 550 + 'px'});
}

function attachEventHandlers() {
    $('#play_mode_button').click(
	function() {
	    playMode();
	}
    );

    $('#playlist_mode_button').click(
	function() {
	    playlistMode();
	}
    );

    $('#skip_button').click(
	function() {
	    send('skip');
	}
    );

    $('#search_text').keydown(
	function(e) {
	    if (e.keyCode != 13) {
		return true;
	    }

	    let query = $('#search_text').val();
	    if (query == '' || query == prevQuery) {
		searchMode();

		return true;
	    }
	    prevQuery = query;

	    send('yt_api_search ' + query);
	    
	    return false;
	}
    );

    $('#search_button').click(
	function() {
	    let query = $('#search_text').val();
	    if (query == '' || query == prevQuery) {
		searchMode();

		return;
	    }
	    prevQuery = query;
	    
	    send('yt_api_search ' + query);
	}
    );
}

// split('a b c d e', ' ', 3) -> ['a', 'b', 'c d e']
function split(str, delimiter, limit) {
    let strs = [];
    
    while (limit - 1 > 0) {
	let idx = str.indexOf(delimiter);
	if (idx == -1) {
	    break;
	}
 
	strs.push(str.substring(0, idx));
	str = str.substring(idx + 1);
 
	limit--;
    }
    strs.push(str);
 
    return strs;
}

$(window).on('load', function() {
    attachEventHandlers();

    window.addEventListener('message', receiveMessage, false);

    send('loaded');
});
