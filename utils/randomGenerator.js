export const generateRandomString = (length = 6) => {
  return Math.random()
    .toString(36)
    .slice(2, length + 2);
};
