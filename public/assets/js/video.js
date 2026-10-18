// Click-to-load YouTube player: swaps the thumbnail link for the player when
// someone presses it, so nothing from YouTube loads (or sets cookies) before then.
// Ctrl/Cmd/Shift/middle-click still open YouTube in a new tab as a normal link.
document.querySelectorAll("a.video[data-youtube-id]").forEach((link) => {
    link.addEventListener("click", (event) => {
        if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();

        const id = encodeURIComponent(link.dataset.youtubeId);
        const frame = document.createElement("iframe");
        frame.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&playsinline=1`;
        frame.title = link.dataset.title || "Video";
        frame.allow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
        frame.allowFullscreen = true;
        frame.referrerPolicy = "strict-origin-when-cross-origin";

        const box = document.createElement("div");
        box.className = "video video-frame";
        box.appendChild(frame);
        link.replaceWith(box);
        frame.focus();
    });
});
