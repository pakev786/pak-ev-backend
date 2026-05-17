import jwt from "jsonwebtoken";

const getSecret = () => process.env.JWT_SECRET || 'default_secret_please_change_in_production';

const generateToken = (id) => {
  return jwt.sign({ id }, getSecret(), {
    expiresIn: '30d',
  });
};

export default generateToken;