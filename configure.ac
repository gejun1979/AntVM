#                                               -*- Autoconf -*-
# Process this file with autoconf to produce a configure script.

AC_PREREQ([2.69])
AC_INIT([antvm], [0.1], [tassardge@hotmail.com])
AC_CONFIG_SRCDIR([config.h.in])
AC_CONFIG_HEADERS([config.h])
AM_INIT_AUTOMAKE

# Checks for programs.
AC_PROG_CC

# Checks for libraries.
AC_PROG_RANLIB

# Checks for header files.
AC_CHECK_HEADERS([malloc.h memory.h stdlib.h string.h unistd.h])

# Checks for typedefs, structures, and compiler characteristics.

# Checks for library functions.
AC_FUNC_MALLOC
AC_CHECK_FUNCS([memset])

AC_CONFIG_FILES([Makefile
                 src/Makefile
                 src/i386/Makefile
                 src/i386/devices/Makefile])
AC_OUTPUT
