const normalizeDomain = (domain) => {
  const trimmed = domain.trim().toLowerCase();
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
};

const isEmailAllowed = (email, configuredDomain) => {
  if (!configuredDomain) {
    throw new Error('Email domain is not configured. Contact the administrator.');
  }

  return email.trim().toLowerCase().endsWith(normalizeDomain(configuredDomain));
};

module.exports = { normalizeDomain, isEmailAllowed };
