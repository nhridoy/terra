class ApiClient {
  async get<T>(_endpoint: string): Promise<T> {
    return {} as T;
  }
  async post<T>(_endpoint: string, _data?: unknown): Promise<T> {
    return {} as T;
  }
  async put<T>(_endpoint: string, _data?: unknown): Promise<T> {
    return {} as T;
  }
  async delete<T>(_endpoint: string): Promise<T> {
    return {} as T;
  }
}

const api = new ApiClient();
export default api;
