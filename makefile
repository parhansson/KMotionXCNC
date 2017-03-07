#TOP?=$(shell pwd)
export BUILD_ROOT := $(shell pwd)
include config.mak

SUBDIRS+=server

KMXPROGS+=kmxWeb$(EXESUF)

all: subdirs

subdirs: $(SUBDIRS)

$(SUBDIRS):
	$(MAKE) -C $@

INSTALL=install

install: subdirs
	mkdir -p "$(bindir)"
	$(INSTALL) -m755 $(addprefix $(BUILD_ROOT)/bin/,$(KMXPROGS)) "$(bindir)"


uninstall:
	rm -fv $(foreach P,$(KMXPROGS),"$(bindir)/$P")

clean:
#rm -f *.o *~
	rm -f ./bin/*
	for n in $(SUBDIRS); do $(MAKE) -C $$n clean; done
	

distclean: clean
	rm -vf config.h config.mak

config.mak:
	@echo "Please run ./configure."
	@exit 1


.PHONY: install uninstall subdirs $(SUBDIRS) clean distclean