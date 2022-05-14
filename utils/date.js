export const TimeValue = {
  getDaysInSeconds(days) {
    return days * 60 * 60 * 24;
  },
  getMinutesInSeconds(minutes) {
    return minutes * 60;
  },
  getHoursInSeconds(hours) {
    return hours * 60 * 60;
  },
};
