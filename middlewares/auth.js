function ensureAuth(req, res, next) {
	if (req.isAuthenticated()) return next();
	res.status(401).json({ message: 'Unauthorized' });
}

function ensureRole(requiredRole) {
	return function(req, res, next) {
		if (!req.isAuthenticated()) {
			return res.status(401).json({ message: 'Unauthorized' });
		}
		if (!req.user || !req.user.role) {
			return res.status(403).json({ message: 'User role not found' });
		}
		
		const roleHierarchy = {
			'free': 1,
			'paid': 2,
			'betatester': 3,
			'admin': 4
		};
		
		const userRoleLevel = roleHierarchy[req.user.role] || 0;
		const requiredRoleLevel = roleHierarchy[requiredRole] || 0;
		
		if (userRoleLevel >= requiredRoleLevel) {
			return next();
		}
		
		res.status(403).json({ message: 'Insufficient permissions' });
	};
}

function ensureAdmin(req, res, next) {
	return ensureRole('admin')(req, res, next);
}

function ensurePaid(req, res, next) {
	return ensureRole('paid')(req, res, next);
}

function ensureBetatester(req, res, next) {
	return ensureRole('betatester')(req, res, next);
}

module.exports = {
	ensureAuth,
	ensureRole,
	ensureAdmin,
	ensurePaid,
	ensureBetatester
};