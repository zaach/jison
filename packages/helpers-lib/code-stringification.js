
/// HELPER FUNCTION: print the function in source code form, properly indented.
/** @public */
function printFunctionSourceCode(f) {
    return String(f);
}

/// HELPER FUNCTION: print the function **content** in source code form, properly indented.
/** @public */
function printFunctionSourceCodeContainer(f) {
    return String(f).replace(/^[\s\r\n]*function\b[^\{]+\{/, '').replace(/\}[\s\r\n]*$/, '');
}



export default {
	printFunctionSourceCode,
	printFunctionSourceCodeContainer,
};
