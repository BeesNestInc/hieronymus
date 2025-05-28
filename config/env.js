import dotenv from 'dotenv';

dotenv.config();

/**
 * Normalize a port into a number, string, or false.
 */
const normalizePort = (val) => {
	var port = parseInt(val, 10);
  
	if (isNaN(port)) {
	  // named pipe
	  return val;
	}
  
	if (port >= 0) {
	  // port number
	  return port;
	}
  
	return false;
  }

export default {
	port: normalizePort(process.env.PORT || '3010'),
	home: process.env.HOME,
	session_ttl: 3600 * 24 * 7,
	session_path: process.env.SESSION_PATH || './sessions',
	backup_dir:  process.env.BACKUP_DIR || './backups'
};
