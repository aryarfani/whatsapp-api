const phoneNumberFormatter = function (number) {
    // Clear non numeric character
    let formatted = number.replace(/\D/g, "");

    // Change to 62 if prefix is 0
    if (formatted.startsWith("0")) {
        formatted = "62" + formatted.substr(1);
    }

    if (!formatted.endsWith("@c.us")) {
        formatted += "@c.us";
    }

    return formatted;
};

module.exports = {
    phoneNumberFormatter
};
