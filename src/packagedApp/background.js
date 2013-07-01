chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('index.html?skipSampleProjectLoad=true', {
    'width': 1200,
    'height': 900
  });
});