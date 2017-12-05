// video data
module.exports = class Video {
    constructor(seq, videoId, played, duration, title) {
	this.seq = seq;
	this.videoId = videoId;
	this.played = played;
	this.duration = duration;
	this.title = title;
    }
}
