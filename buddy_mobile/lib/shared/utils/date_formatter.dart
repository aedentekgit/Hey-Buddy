import 'package:intl/intl.dart';

class DateFormatter {
  static String formatTime(DateTime date, {String format = '12'}) {
    if (format == '24') {
      return DateFormat('HH:mm').format(date);
    }
    return DateFormat('hh:mm a').format(date);
  }

  static String formatDate(DateTime date, {String format = 'DD/MM/YYYY'}) {
    try {
      if (format == 'MM/DD/YYYY') {
        return DateFormat('MM/dd/yyyy').format(date);
      } else if (format == 'YYYY-MM-DD') {
        return DateFormat('yyyy-MM-dd').format(date);
      } else {
        return DateFormat('dd/MM/yyyy').format(date);
      }
    } catch (e) {
      return DateFormat('dd/MM/yyyy').format(date);
    }
  }
}
