/**
 * Policies for casbin
 * If this was a file it would have .csv extension
 */
export const casbinPolicies = `
p, app_owner, /*,  (read)|(write)read
p, app_owner, /*, write

p, app_admin, /companies/*,  (read)|(write)

p, app_admin, /users/*,  (read)|(write)

p, owner, /companies/:id,  (read)|(write)
p, owner, /companies/:id/*, (read)|(write)

p, admin, /companies/:id/subscription, (read)|(write)
p, admin, /companies/:id/subscription/*, (read)|(write)

p, admin, /companies/:id/locations, (read)|(write)
p, admin, /companies/:id/locations/*, (read)|(write)

p, admin, /companies/:id/roles, read
p, admin, /companies/:id/roles/*, read

p, user, /users/:id/*, read
p, user, /users/:id, read
`;
