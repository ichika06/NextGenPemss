if (import.meta.env.PROD) {
  console.clear(); // optional

  console.log('%c⚠️ Stop!', 'color: red; font-size: 48px; font-weight: bold;');

  console.log(
    '%cThis is a browser feature intended for developers. ' +
    'If someone told you to copy and paste something here to "hack" someone’s account, ' +
    'it is a scam and will give them access to your account.\n\n' +
    'color: gray; font-size: 16px; max-width: 600px;'
  );
}