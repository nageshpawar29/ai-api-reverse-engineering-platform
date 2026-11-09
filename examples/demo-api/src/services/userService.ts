export class UserService {
  static async findByEmail(email: string) {
    return { id: 'usr-1', email, name: 'Alice' };
  }

  static async findById(id: string) {
    return { id, email: 'alice@example.com', name: 'Alice' };
  }

  static async createUser(data: { email: string; name: string; passwordHash: string }) {
    return { id: 'usr-2', ...data };
  }

  static async getAllUsers(limit = 10, offset = 0) {
    return [{ id: 'usr-1', name: 'Alice' }, { id: 'usr-2', name: 'Bob' }];
  }
}
