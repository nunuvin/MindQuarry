// Mock for better auth client
export const authClient = {
  useSession: () => ({ data: null, isPending: false }),
};
