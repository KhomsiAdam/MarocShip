const jwt = require('jsonwebtoken');

const { userSchema } = require('../helpers/validation');
const { setAccessSecret, setRefreshSecret } = require('../helpers/secret');

// Access Token generation when login
const generateAccessToken = (user, role) => {
  const payload = {
    _id: user._id,
    email: user.email,
  };
  return jwt.sign(
    payload,
    setAccessSecret(role),
    { expiresIn: '15m' },
  );
};

// Refresh Token generation when login
const generateRefreshToken = (user, role) => {
  const payload = {
    _id: user._id,
    email: user.email,
  };
  return jwt.sign(
    payload,
    setRefreshSecret(role),
    { expiresIn: '7d' },
  );
};

// Send refresh token and set to coookie
const sendRefreshToken = (res, token) => {
  res.cookie(
    'rtkn',
    token,
    {
      httpOnly: true,
      path: '/refresh',
    },
  );
};

// Unauthorized error
const unAuthorized = (res, next) => {
  const error = new Error('Unauthorized.');
  res.status(401);
  next(error);
};

// Is authenticated middleware
const isAuth = (role) => (req, res, next) => {
  const authHeader = req.get('Authorization');
  if (authHeader) {
    const token = authHeader.split(' ')[1];
    if (token) {
      jwt.verify(token, setAccessSecret(role), (error, user) => {
        if (error) {
          res.setHeader('Content-Type', 'application/json');
          next(error);
        }
        req.user = user;
        next();
      });
    } else {
      unAuthorized(res, next);
    }
  } else {
    unAuthorized(res, next);
  }
};

// Is logged in
const isLoggedIn = (req, res, next) => {
  if (req.user) {
    next();
  } else {
    unAuthorized(res, next);
  }
};

// User validation
const validateUser = (defaultErrorMessage = '') => (req, res, next) => {
  const result = userSchema.validate(req.body);
  if (!result.error) {
    next();
  } else {
    const error = defaultErrorMessage ? new Error(defaultErrorMessage) : result.error;
    res.status(422);
    next(error);
  }
};

// Find user with provided credentials
const findUser = (Model, defaultLoginError, isError, errorCode = 422) => async (req, res, next) => {
  try {
    const user = await Model.findOne({
      email: req.body.email,
    }, 'email password');
    if (isError(user)) {
      res.status(errorCode);
      next(new Error(defaultLoginError));
    } else {
      req.user = user;
      next();
    }
  } catch (error) {
    res.status(500);
    next(error);
  }
};

module.exports = {
  isAuth,
  isLoggedIn,
  validateUser,
  findUser,
  generateAccessToken,
  generateRefreshToken,
  sendRefreshToken,
};
