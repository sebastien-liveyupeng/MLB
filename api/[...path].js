const url = require('url');

const authLogin = require('../api_handlers/auth/login');
const authLogout = require('../api_handlers/auth/logout');
const authProfile = require('../api_handlers/auth/profile');
const authSession = require('../api_handlers/auth/session');
const authSignup = require('../api_handlers/auth/signup');

const chatMessages = require('../api_handlers/chat/messages');
const chatSend = require('../api_handlers/chat/send');

const compositionsIndex = require('../api_handlers/compositions/index');
const compositionsShare = require('../api_handlers/compositions/share');

const friendsHandler = require('../api_handlers/friends');
const friendsIndex = require('../api_handlers/friends/index');
const friendsRequest = require('../api_handlers/friends/request');
const friendsRespond = require('../api_handlers/friends/respond');
const friendsSearch = require('../api_handlers/friends/search');

const usersIndex = require('../api_handlers/users/index');
const usersProfile = require('../api_handlers/users/profile');
const usersAvatar = require('../api_handlers/users/avatar');

const mediaUpload = require('../api_handlers/media/upload');
const mediaFeed = require('../api_handlers/media/feed');
const mediaLike = require('../api_handlers/media/like');
const mediaComment = require('../api_handlers/media/comment');
const mediaComments = require('../api_handlers/media/comments');
const mediaDelete = require('../api_handlers/media/delete');

module.exports = async function handler(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname || '';
  const route = pathname.replace(/^\/api\/?/, '');

  req.query = parsedUrl.query || {};

  switch (route) {
    case 'auth/login':
      return authLogin(req, res);
    case 'auth/logout':
      return authLogout(req, res);
    case 'auth/profile':
      return authProfile(req, res);
    case 'auth/session':
      return authSession(req, res);
    case 'auth/signup':
      return authSignup(req, res);

    case 'chat/messages':
      return chatMessages(req, res);
    case 'chat/send':
      return chatSend(req, res);

    case 'compositions':
      return compositionsIndex(req, res);
    case 'compositions/share':
      return compositionsShare(req, res);

    case 'friends':
      return friendsHandler(req, res);
    case 'friends/index':
      return friendsIndex(req, res);
    case 'friends/request':
      return friendsRequest(req, res);
    case 'friends/respond':
      return friendsRespond(req, res);
    case 'friends/search':
      return friendsSearch(req, res);

    case 'users':
      return usersIndex(req, res);
    case 'users/profile':
      return usersProfile(req, res);
    case 'users/avatar':
      return usersAvatar(req, res);

    case 'media/upload':
      return mediaUpload(req, res);
    case 'media/feed':
      return mediaFeed(req, res);
    case 'media/like':
      return mediaLike(req, res);
    case 'media/comment':
      return mediaComment(req, res);
    case 'media/comments':
      return mediaComments(req, res);
    case 'media/delete':
      return mediaDelete(req, res);

    case '':
      return res.status(200).json({ success: true, message: 'API OK' });
    default:
      return res.status(404).json({ error: 'Not found' });
  }
};
