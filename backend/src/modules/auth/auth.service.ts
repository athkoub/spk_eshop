// This file re-exports user authentication services for consistency
// All auth logic is implemented in the users module

export { userService as authService } from '../users/user.service';