$( document ).ready(function () {
    var zonalizer = {
        api: {
            ok: function () {
                $('.navbar-text .label-warning, .navbar-text .label-danger')
                .removeClass('label-warning')
                .removeClass('label-danger')
                .addClass('label-success')
                .text('API ONLINE');
            },
            checking: function () {
                $('.navbar-text .label-danger')
                .removeClass('label-danger')
                .addClass('label-warning')
                .text('CHECKING API');
            },
            error: function () {
                $('.navbar-text .label-success, .navbar-text .label-warning')
                .removeClass('label-success')
                .removeClass('label-warning')
                .addClass('label-danger')
                .text('API ERROR');
            },
            down: function () {
                $('.navbar-text .label-success, .navbar-text .label-warning')
                .removeClass('label-success')
                .removeClass('label-warning')
                .addClass('label-danger')
                .text('API DOWN');
            }
        },
        status: {
            running: false,
            _interval: null,
            _timer: 2000,
            start: function () {
                if (!zonalizer.status._interval) {
                    zonalizer.status._interval = window.setInterval(function () {
                        zonalizer.status.update();
                    }, zonalizer.status._timer);
                    zonalizer.status.update();
                }
                zonalizer.status.running = true;
            },
            stop: function () {
                if (zonalizer.status._interval) {
                    window.clearInterval(zonalizer.status._interval);
                    zonalizer.status._interval = null;
                }
                zonalizer.status.running = false;
            },
            pause: function () {
                if (zonalizer.status.running) {
                    window.clearInterval(zonalizer.status._interval);
                    zonalizer.status._interval = null;
                }
            },
            resume: function () {
                if (zonalizer.status.running) {
                    zonalizer.status.start();
                }
            },
            update: function () {
                zonalizer.api.checking();
                $.ajax({
                    dataType: 'json',
                    url: '/zonalizer/1/status',
                    method: 'GET'
                })
                .done(function (data) {
                    if (data.analysis && typeof data.analysis === 'object' && data.analysis.ongoing !== undefined && data.analysis.completed !== undefined && data.analysis.failed !== undefined) {
                        $('.row .panel-body dd:eq(0)').text(data.analysis.ongoing);
                        $('.row .panel-body dd:eq(1)').text(data.analysis.completed);
                        $('.row .panel-body dd:eq(2)').text(data.analysis.failed);
                        zonalizer.api.ok();

                        if (parseInt(data.analysis.ongoing)) {
                            zonalizer.mini.start();
                        }
                        else {
                            zonalizer.mini.stop();
                        }
                    }
                    else {
                        zonalizer.api.error();
                    }
                })
                .fail(function () {
                    zonalizer.api.down();
                });
            }
        },
        mini: {
            _num: 0,
            _id: {},
            _interval: null,
            _check_timer: 2000,
            _update_timer: 1500,
            start: function () {
                if (!zonalizer.mini._interval) {
                    zonalizer.mini._interval = window.setInterval(function () {
                        zonalizer.mini.check();
                    }, zonalizer.mini._check_timer);
                    zonalizer.mini.check();
                }
            },
            stop: function () {
                if (zonalizer.mini._interval) {
                    window.clearInterval(zonalizer.mini._interval);
                    zonalizer.mini._interval = null;
                }
                for (var key in zonalizer.mini._id) {
                    window.clearInterval(zonalizer.mini._id[key].interval);
                    $(zonalizer.mini._id[key].mini).remove();
                }
                zonalizer.mini._num = 0;
                zonalizer.mini._id = {};
                $('#minis > p').show();
            },
            check: function () {
                if (zonalizer.mini._num > 9) {
                    return;
                }

                $.ajax({
                    dataType: 'json',
                    url: '/zonalizer/1/analysis',
                    method: 'GET'
                })
                .done(function (data) {
                    if (data.analyze && typeof data.analyze === 'object' && (data.analyze.isArray || data.analyze instanceof Array)) {
                        data.analyze.sort(function (a, b) {
                            return b.updated - a.updated;
                        });

                        $(data.analyze).each(function (index) {
                            if (zonalizer.mini._num > 9 || this.progress >= 100 || zonalizer.mini._id[this.id]) {
                                return;
                            }

                            var mini = $(
                            '<div>'
                                +'<p></p>'
                                +'<div class="progress" style="height: 5px;">'
                                    +'<div class="progress-bar active" role="progressbar" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100" style="width: 0%"></div>'
                                +'</div>'
                            +'</div>');
                            $('p', mini).text(this.fqdn);
                            var id = this.id;
                            $(mini).click(function () {
                                var href = window.location.href.replace(/\?.*$/, '').replace(/#.*$/, '');
                                window.location.href = href+'?'+id;
                            });
                            $(mini).fadeIn('fast').appendTo($('#minis'));

                            var interval, id = this.id;
                            interval = window.setInterval(function () {
                                zonalizer.mini.update(mini, id, interval);
                            }, zonalizer.mini._update_timer);

                            zonalizer.mini._num++;
                            zonalizer.mini._id[this.id] = {
                                mini: mini,
                                id: id,
                                interval: interval,
                            }
                            zonalizer.mini.noRestForTheWicked();
                        });
                    }
                });
            },
            update: function (mini, id, interval) {
                $.ajax({
                    dataType: 'json',
                    url: '/zonalizer/1/analysis/'+id,
                    data: {
                        results: 0
                    },
                    method: 'GET'
                })
                .done(function (data) {
                    if (typeof data === 'object' && data.fqdn && data.progress > -1) {
                        $('p', mini).text(data.fqdn);
                        $('.progress-bar', mini).attr('aria-valuenow', data.progress);
                        $('.progress-bar', mini).width(''+data.progress+'%');
                        if (data.progress < 100) {
                            return;
                        }
                    }
                    else {
                        zonalizer.api.error();
                    }

                    zonalizer.mini.remove(mini, id, interval);
                })
                .fail(function () {
                    zonalizer.api.down();
                    zonalizer.mini.remove(mini, id, interval);
                });
            },
            remove: function (mini, id, interval) {
                window.clearInterval(interval);
                delete zonalizer.mini._id[id];
                zonalizer.mini._num--;
                $(mini).fadeOut('fast', function () {
                    $(mini).remove();
                    zonalizer.mini.onBreak();
                });
            },
            noRestForTheWicked: function () {
                $('#minis > p').fadeOut('fast');
            },
            onBreak: function () {
                if (!zonalizer.mini._num) {
                    $('#minis > p').fadeIn('fast');
                }
            }
        },
        analyze: {
            _id: null,
            _interval: null,
            _timer: 1500,
            start: function () {
                if (zonalizer.analyze._id && !zonalizer.analyze._interval) {
                    zonalizer.analyze._interval = window.setInterval(function () {
                        zonalizer.analyze.update();
                    }, zonalizer.analyze._timer);
                }
            },
            stop: function () {
                if (zonalizer.analyze._interval) {
                    window.clearInterval(zonalizer.analyze._interval);
                    zonalizer.analyze._interval = null;
                }
                zonalizer.analyze._id = null;
            },
            fail: function () {
                zonalizer.analyze.stop();
                $('.jumbotron h1').text('Analyze Your Zone Now');
                $('.jumbotron p').text('Don\'t let broken zones stop your users from surfing, analyze and fix them today!');
                $('.jumbotron .progress, .table, .jumbotron > div > div:eq(1), .container > p').fadeOut('fast').promise().done(function () {
                    $('.jumbotron .form-group, div.row, .alert').fadeIn('fast').promise().done(function () {
                        zonalizer.status.start();
                    });
                });
            },
            done: function () {
                zonalizer.analyze.stop();
                $('.jumbotron h1').text('Analyze Your Zone Now');
                $('.jumbotron p').text('Don\'t let broken zones stop your users from surfing, analyze and fix them today!');
                $('.table, .jumbotron > div > div:eq(1)').fadeOut('fast').promise().done(function () {
                    $('.jumbotron .form-group, div.row').fadeIn('fast').promise().done(function () {
                        zonalizer.status.start();
                    });
                });
            },
            update: function () {
                if (!zonalizer.analyze._id) {
                    return;
                }

                $.ajax({
                    dataType: 'json',
                    url: '/zonalizer/1/analysis/'+zonalizer.analyze._id,
                    data: {
                        last_results: 5
                    },
                    method: 'GET'
                })
                .done(function (data) {
                    if (typeof data === 'object' && data.progress > -1) {
                        $('.jumbotron .progress-bar').attr('aria-valuenow', data.progress);
                        $('.jumbotron .progress-bar').width(''+data.progress+'%');
                        $('.jumbotron .progress-bar span').text(''+data.progress+'% Complete');

                        if (!(data.results && typeof data.results === 'object' && (data.results.isArray || data.results instanceof Array))) {
                            return;
                        }

                        if (data.progress >= 100) {
                            var id = zonalizer.analyze._id;
                            zonalizer.analyze.stop();

                            $('.jumbotron h1').text('Analyze Results');
                            $('.container > p, .jumbotron .progress').fadeOut('fast').promise().done(function () {
                                $('.jumbotron .progress-bar').attr('aria-valuenow', 0);
                                $('.jumbotron .progress-bar').width('0%');
                                $('.jumbotron .progress-bar span').text('0% Complete');
                            });

                            $.ajax({
                                dataType: 'json',
                                url: '/zonalizer/1/analysis/'+id,
                                method: 'GET'
                            })
                            .done(function (data) {
                                if (typeof data === 'object' && data.id && data.results && typeof data.results === 'object' && (data.results.isArray || data.results instanceof Array)) {
                                    var href = window.location.href.replace(/\?.*$/, '').replace(/#.*$/, '');
                                    $('.table a').attr('href', '?'+data.id).text(href+'?'+data.id);

                                    zonalizer.analyze.display(data.results);

                                    $('.table, .jumbotron > div > div:eq(1)').fadeIn('fast');
                                    return;
                                }

                                zonalizer.api.error();
                                zonalizer.analyze.fail();
                            })
                            .fail(function () {
                                zonalizer.api.down();
                                zonalizer.analyze.fail();
                            });
                        }
                        else {
                            data.results.sort(function (a, b) {
                                return b.timestamp - a.timestamp;
                            });

                            $('.container > p').empty();
                            for (var i = 0, m = 0; m < 10 && i < data.results.length; i++) {
                                if (data.results[i].message) {
                                    $('<span class="clearfix"></span>').text(data.results[i].message.replace(/,[^ ]/g, ', ').replace(/;[^ ]/g, '; ')).appendTo('.container > p');
                                    m++;
                                }
                            }
                        }
                        return;
                    }

                    zonalizer.api.error();
                    zonalizer.analyze.fail();
                })
                .fail(function () {
                    zonalizer.api.down();
                    zonalizer.analyze.fail();
                });
            },
            load: function (id) {
                $('.jumbotron h1').text('Loading analyze ...');
                $('.jumbotron p').text('');
                $('.jumbotron .form-group, div.row, .alert').hide();

                $.ajax({
                    dataType: 'json',
                    url: '/zonalizer/1/analysis/'+id,
                    method: 'GET'
                })
                .done(function (data) {
                    if (typeof data === 'object' && data.id && data.fqdn && data.progress > -1) {
                        zonalizer.api.ok();

                        if (data.progress >= 100 && data.results && typeof data.results === 'object' && (data.results.isArray || data.results instanceof Array)) {
                            $('.jumbotron h1').text('Analyze Results');
                            $('.jumbotron p').text(data.fqdn);
                            $('.container > p, .jumbotron .progress').fadeOut('fast').promise().done(function () {
                                $('.table, .jumbotron > div > div:eq(1)').fadeIn('fast');
                            });

                            var href = window.location.href.replace(/\?.*$/, '').replace(/#.*$/, '');
                            $('.table a').attr('href', '?'+data.id).text(href+'?'+data.id);

                            zonalizer.analyze.display(data.results);
                        }
                        else {
                            $('.jumbotron h1').text('Analysing ...');
                            $('.jumbotron p').text(data.fqdn);
                            $('.jumbotron .form-group, div.row, .alert').fadeOut('fast').promise().done(function () {
                                $('.jumbotron .progress').fadeIn('fast');
                            });
                            zonalizer.analyze._id = id;
                            zonalizer.analyze.start();
                        }
                        return;
                    }

// TODO: Need to check for missing
                    zonalizer.api.error();
                    zonalizer.analyze.fail();
                })
                .fail(function () {
// TODO: Need to check for missing
                    zonalizer.api.down();
                    zonalizer.analyze.fail();
                });
            },
            zone: function (zone) {
                $('.jumbotron h1').text('Analysing ...');
                $('.jumbotron p').text(zone);
                $('.jumbotron .form-group, div.row, .alert').fadeOut('fast').promise().done(function () {
                    $('.container > p').empty();
                    $('.jumbotron .progress, .container > p').fadeIn('fast').promise().done(function () {
                        $.ajax({
                            dataType: 'json',
                            url: '/zonalizer/1/analysis',
                            data: {
                                fqdn: zone
                            },
                            method: 'POST'
                        })
                        .done(function (data) {
                            if (typeof data === 'object' && data.id) {
                                zonalizer.analyze._id = data.id;
                                zonalizer.analyze.start();
                                return;
                            }

                            zonalizer.api.error();
                            zonalizer.analyze.fail();
                        })
                        .fail(function (xhr, textStatus) {
                            zonalizer.api.down();
                            zonalizer.analyze.fail();
                        });
                    });
                });
            },
            display: function (results) {
                results.sort(function (a, b) {
                    return a.timestamp - b.timestamp;
                });

                $('tbody').empty();
                var i = 1;
                $(results).each(function (index) {
                    var tr = $('<tr></tr>');
                    if (this.level == 'DEBUG') {
                        tr.addClass('text-muted');
                    }
                    else if (this.level == 'NOTICE') {
                        tr.addClass('info');
                    }
                    else if (this.level == 'WARNING') {
                        tr.addClass('warning');
                    }
                    else if (this.level == 'ERROR') {
                        tr.addClass('danger');
                    }
                    $('<th scope="row"></th>').text(i++).appendTo(tr);
                    $('<td></td>').text(this.module).appendTo(tr);
                    $('<td></td>').text(this.level).appendTo(tr);
                    $('<td></td>').text(this.tag).appendTo(tr);
                    $('<td style="text-align: left;"></td>').text(this.message ? this.message.replace(/,[^ ]/g, ', ').replace(/;[^ ]/g, '; ') : '...').appendTo(tr);
                    tr.appendTo($('tbody'));
                });
            }
        }
    };

    $(document).on({
        'show': function() {
            zonalizer.status.resume();
        },
        'hide': function() {
            zonalizer.status.pause();
        }
    });

    $('.jumbotron .progress, .alert, .table, .jumbotron > div > div:eq(1)').hide();
    $('.alert button').click(function () {
        $('.alert').fadeOut('fast');
    });

    $('form button').prop('disabled', true);
    $('input:eq(0)').on('input propertychange paste', function() {
        var zone = $('input:eq(0)').val();

        if (zone && zone.match(/^[a-zA-Z0-9\.-]+$/)) {
            $('form button').prop('disabled', false);
        }
        else {
            $('form button').prop('disabled', true);
        }
    });
    $('form').submit(function (event) {
        var zone = $('input:eq(0)').val();

        if (zone && zone.match(/^[a-zA-Z0-9\.-]+$/)) {
            zonalizer.mini.stop();
            zonalizer.status.stop();
            zonalizer.analyze.zone(zone);
        }

        event.preventDefault();
        return false;
    });
    $('.jumbotron > div > div:eq(1) > button').click(function () {
        if (window.location.search) {
            window.location.search = '';
        }
        $('input:eq(0)').val('');
        zonalizer.analyze.done();
    });

    if (window.location.search.match(/^\?[a-zA-Z0-9_=\-]+$/)) {
        zonalizer.analyze.load(window.location.search.substr(1));
    }
    else {
        zonalizer.status.start();
    }
});
