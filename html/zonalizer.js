(function ( $ ) {

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
                    url: '/zonalizer/1/analysis?ongoing=1',
                    method: 'GET'
                })
                .done(function (data) {
                    if (data.analysis && typeof data.analysis === 'object' && (data.analysis.isArray || data.analysis instanceof Array)) {
                        data.analysis.sort(function (a, b) {
                            return b.updated - a.updated;
                        });

                        $(data.analysis).each(function (index) {
                            if (zonalizer.mini._num > 9 || this.progress >= 100 || zonalizer.mini._id[this.id]) {
                                return;
                            }

                            var mini = $(
                            '<div style="cursor: pointer; cursor: hand">'
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
            _lang: 'en_US',
            _show: {
                all: 1,
                info: 0,
                notice: 0,
                warning: 0,
                error: 0,
                critical: 0
            },
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
                $('.jumbotron .progress, .table, .nav-pills, .jumbotron > div > div:eq(1) > button, .container > p').fadeOut('fast').promise().done(function () {
                    $('.jumbotron .form-group:eq(0), div.row, .alert').fadeIn('fast').promise().done(function () {
                        zonalizer.status.start();
                    });
                });
            },
            done: function () {
                zonalizer.analyze.stop();
                $('.jumbotron h1').text('Analyze Your Zone Now');
                $('.jumbotron p').text('Don\'t let broken zones stop your users from surfing, analyze and fix them today!');
                $('.table, .nav-pills, .jumbotron > div > div:eq(1) > button').fadeOut('fast').promise().done(function () {
                    $('.jumbotron .form-group:eq(0), div.row').fadeIn('fast').promise().done(function () {
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

                                    zonalizer.analyze._id = id;
                                    zonalizer.analyze.display(data);

                                    $('.table, .nav-pills, .jumbotron > div > div:eq(1) > button').fadeIn('fast');
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
                $('.jumbotron .form-group:eq(0), div.row, .alert').hide();

                zonalizer.analyze._id = id;
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
                                $('.table, .nav-pills, .jumbotron > div > div:eq(1) > button').fadeIn('fast');
                            });

                            zonalizer.analyze.display(data);
                        }
                        else {
                            $('.jumbotron h1').text('Analysing ...');
                            $('.jumbotron p').text(data.fqdn);
                            $('.jumbotron .form-group:eq(0), div.row, .alert').fadeOut('fast').promise().done(function () {
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
                $('.jumbotron .form-group:eq(0), div.row, .alert').fadeOut('fast').promise().done(function () {
                    $('.container > p').empty();
                    $('.jumbotron .progress, .container > p').fadeIn('fast').promise().done(function () {
                        $.ajax({
                            dataType: 'json',
                            url: '/zonalizer/1/analysis',
                            data: {
                                fqdn: zone,
                                ipv4: $('#ipv4').is(':checked') == true ? 1 : 0,
                                ipv6: $('#ipv6').is(':checked') == true ? 1 : 0
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
            display: function (data) {
                var href = window.location.href.replace(/\?.*$/, '').replace(/#.*$/, '');
                $('.table caption > a').attr('href', '?'+data.id).text(href+'?'+data.id);

                $('.nav-pills span.glyphicon').removeClass('glyphicon-ok-circle glyphicon-ban-circle text-success text-danger');
                if ( data.ipv4 ) {
                    $('.nav-pills span.glyphicon:eq(1)').addClass('text-success glyphicon-ok-circle');
                }
                else {
                    $('.nav-pills span.glyphicon:eq(1)').addClass('text-danger glyphicon-ban-circle');
                }
                if ( data.ipv6 ) {
                    $('.nav-pills span.glyphicon:eq(0)').addClass('text-success glyphicon-ok-circle');
                }
                else {
                    $('.nav-pills span.glyphicon:eq(0)').addClass('text-danger glyphicon-ban-circle');
                }

                data.results.sort(function (a, b) {
                    return a.timestamp - b.timestamp;
                });

                $('tbody').empty();
                var i = 1, info = 0, notice = 0, warning = 0, error = 0, critical = 0;
                $(data.results).each(function (index) {
                    var tr = $('<tr></tr>');
                    if (this.level == 'DEBUG') {
                        tr.addClass('text-muted');
                    }
                    else if (this.level == 'NOTICE') {
                        tr.addClass('info');
                        notice++;
                    }
                    else if (this.level == 'WARNING') {
                        tr.addClass('warning');
                        warning++;
                    }
                    else if (this.level == 'ERROR') {
                        tr.addClass('danger');
                        tr.addClass('za-error');
                        error++;
                    }
                    else if (this.level == 'CRITICAL') {
                        tr.addClass('danger');
                        tr.addClass('za-critical');
                        critical++;
                    }
                    else {
                        tr.addClass('za-info');
                        info++;
                    }
                    $('<th scope="row"></th>').text(i++).appendTo(tr);
                    $('<td></td>').text(this.module).appendTo(tr);
                    $('<td></td>').text(this.level).appendTo(tr);
                    $('<td></td>').text(this.tag).appendTo(tr);
                    $('<td style="text-align: left;"></td>').text(this.message ? this.message.replace(/,(?! )/g, ', ').replace(/;(?! )/g, '; ') : '...').appendTo(tr);

                    tr.appendTo($('tbody'));

                    $('.nav-pills > li:eq(2) .badge').text(info);
                    $('.nav-pills > li:eq(3) .badge').text(notice);
                    $('.nav-pills > li:eq(4) .badge').text(warning);
                    $('.nav-pills > li:eq(5) .badge').text(error);
                    $('.nav-pills > li:eq(6) .badge').text(critical);
                });
            },
            switchLang: function (lang) {
                if (!zonalizer.analyze._id || lang == zonalizer.analyze._lang) {
                    return;
                }

                zonalizer.analyze._lang = lang;
                $.ajax({
                    dataType: 'json',
                    url: '/zonalizer/1/analysis/'+zonalizer.analyze._id+'?lang='+lang,
                    method: 'GET'
                })
                .done(function (data) {
                    if (typeof data === 'object' && data.id && data.fqdn && data.progress > -1) {
                        zonalizer.api.ok();

                        if (data.progress >= 100 && data.results && typeof data.results === 'object' && (data.results.isArray || data.results instanceof Array)) {
                            zonalizer.analyze.display(data);

                            if (!zonalizer.analyze._show.all) {
                                if (!zonalizer.analyze._show.info) {
                                    $('tbody tr.za-info').hide();
                                }
                                if (!zonalizer.analyze._show.notice) {
                                    $('tbody tr.info').hide();
                                }
                                if (!zonalizer.analyze._show.warning) {
                                    $('tbody tr.warning').hide();
                                }
                                if (!zonalizer.analyze._show.error) {
                                    $('tbody tr.za-error').hide();
                                }
                                if (!zonalizer.analyze._show.critical) {
                                    $('tbody tr.za-critical').hide();
                                }
                            }
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
            toggle: function (what) {
                if (what != 'all' && zonalizer.analyze._show.all) {
                    $('tbody tr').hide();
                    zonalizer.analyze._show.all = 0;
                    $('.nav-pills > li:eq(1)').removeClass('active');
                }
                switch (what) {
                    case 'info':
                        if (zonalizer.analyze._show.info) {
                            $('tbody tr.za-info').hide();
                            $('.nav-pills > li:eq(2)').removeClass('active info');
                        }
                        else {
                            $('tbody tr.za-info').show();
                            $('.nav-pills > li:eq(2)').addClass('active info');
                        }
                        zonalizer.analyze._show.info = zonalizer.analyze._show.info ? 0 : 1;
                        break;

                    case 'notice':
                        if (zonalizer.analyze._show.notice) {
                            $('tbody tr.info').hide();
                            $('.nav-pills > li:eq(3)').removeClass('active notice');
                        }
                        else {
                            $('tbody tr.info').show();
                            $('.nav-pills > li:eq(3)').addClass('active notice');
                        }
                        zonalizer.analyze._show.notice = zonalizer.analyze._show.notice ? 0 : 1;
                        break;

                    case 'warning':
                        if (zonalizer.analyze._show.warning) {
                            $('tbody tr.warning').hide();
                            $('.nav-pills > li:eq(4)').removeClass('active warning');
                        }
                        else {
                            $('tbody tr.warning').show();
                            $('.nav-pills > li:eq(4)').addClass('active warning');
                        }
                        zonalizer.analyze._show.warning = zonalizer.analyze._show.warning ? 0 : 1;
                        break;

                    case 'error':
                        if (zonalizer.analyze._show.error) {
                            $('tbody tr.za-error').hide();
                            $('.nav-pills > li:eq(5)').removeClass('active danger');
                        }
                        else {
                            $('tbody tr.za-error').show();
                            $('.nav-pills > li:eq(5)').addClass('active danger');
                        }
                        zonalizer.analyze._show.error = zonalizer.analyze._show.error ? 0 : 1;
                        break;

                    case 'critical':
                        if (zonalizer.analyze._show.critical) {
                            $('tbody tr.za-critical').hide();
                            $('.nav-pills > li:eq(6)').removeClass('active danger');
                        }
                        else {
                            $('tbody tr.za-critical').show();
                            $('.nav-pills > li:eq(6)').addClass('active danger');
                        }
                        zonalizer.analyze._show.critical = zonalizer.analyze._show.critical ? 0 : 1;
                        break;

                    default:
                        zonalizer.analyze._show.all = 1;
                        zonalizer.analyze._show.info = 0;
                        zonalizer.analyze._show.notice = 0;
                        zonalizer.analyze._show.warning = 0;
                        zonalizer.analyze._show.error = 0;
                        zonalizer.analyze._show.critical = 0;
                        $('tbody tr').show();
                        $('.nav-pills > li:eq(2)').removeClass('active info');
                        $('.nav-pills > li:eq(3)').removeClass('active notice');
                        $('.nav-pills > li:eq(4)').removeClass('active warning');
                        $('.nav-pills > li:eq(5)').removeClass('active danger');
                        $('.nav-pills > li:eq(6)').removeClass('active danger');
                        $('.nav-pills > li:eq(1)').addClass('active');
                }

                if (!zonalizer.analyze._show.all
                    && !zonalizer.analyze._show.info
                    && !zonalizer.analyze._show.notice
                    && !zonalizer.analyze._show.warning
                    && !zonalizer.analyze._show.error
                    && !zonalizer.analyze._show.critical)
                {
                    zonalizer.analyze._show.all = 1;
                    $('tbody tr').show();
                    $('.nav-pills > li:eq(1)').addClass('active');
                }
            }
        },
        browse: {
            _previous: null,
            _next: null,
            _sort: null,
            _direction: null,
            _th: {
                fqdn: { n: 0, d: 'ascending' },
                created: { n: 3, d: 'descending' }
            },
            fail: function () {
                $('table').hide();
                $('.pagination').parent().hide();
                $('.alert').show();
            },
            init: function () {
                $('table').show();
                $('.pagination').parent().show();
                $('.pagination li:eq(0)').click(function (event) {
                    zonalizer.browse.load();
                    event.preventDefault();
                    return false;
                });
                $('.pagination li:eq(1)').click(function (event) {
                    if (zonalizer.browse._previous) {
                        zonalizer.browse.load(zonalizer.browse._previous);
                    }
                    event.preventDefault();
                    return false;
                });
                $('.pagination li:eq(2)').click(function (event) {
                    if (zonalizer.browse._next) {
                        zonalizer.browse.load(zonalizer.browse._next);
                    }
                    event.preventDefault();
                    return false;
                });
                zonalizer.browse.sort('created');
                $('thead th:eq(0)').click(function (event) {
                    zonalizer.browse.sort('fqdn');
                    zonalizer.browse.load();
                    event.preventDefault();
                    return false;
                });
                $('thead th:eq(3)').click(function (event) {
                    zonalizer.browse.sort('created');
                    zonalizer.browse.load();
                    event.preventDefault();
                    return false;
                });
            },
            sort: function (what) {
                if ( (typeof zonalizer.browse._th[what]) !== 'object' ) {
                    return;
                }

                if ( zonalizer.browse._sort == what ) {
                    zonalizer.browse._direction = zonalizer.browse._direction == 'ascending' ? 'descending' : 'ascending';
                }
                else {
                    zonalizer.browse._sort = what;
                    zonalizer.browse._direction = zonalizer.browse._th[what].d;
                }

                $('thead th span')
                .removeClass('glyphicon-sort-by-attributes')
                .removeClass('glyphicon-sort-by-attributes-alt')
                .addClass('text-muted')
                .addClass('glyphicon-sort');

                $('thead th:eq('+zonalizer.browse._th[what].n+') span')
                .removeClass('text-muted')
                .removeClass('glyphicon-sort')
                .addClass( zonalizer.browse._direction == 'ascending' ? 'glyphicon-sort-by-attributes' : 'glyphicon-sort-by-attributes-alt' );
            },
            load: function (url) {
                if (!url) {
                    url = '/zonalizer/1/analysis?sort='+zonalizer.browse._sort+'&direction='+zonalizer.browse._direction;
                }

                $.ajax({
                    dataType: 'json',
                    url: url,
                    method: 'GET'
                })
                .done(function (data) {
                    if (data.analysis && typeof data.analysis === 'object' && (data.analysis.isArray || data.analysis instanceof Array)) {
                        for (var i = 0; i < data.analysis.length; i++) {
                            if (typeof data.analysis[i] === 'object' && typeof data.analysis[i].summary === 'object') {
                                continue;
                            }

                            data.analysis = null;
                            break;
                        }

                        if (data.analysis) {
                            zonalizer.browse.display(data.analysis);

                            $('tbody tr').click(function () {
                                if ($(this).data('zonalizer-id')) {
                                    window.location.href = '/?'+$(this).data('zonalizer-id');
                                }
                            });

                            if (data.paging && typeof data.paging === 'object' && data.paging.previous) {
                                zonalizer.browse._previous = data.paging.previous;
                                $('.pagination li:eq(0)').removeClass('disabled');
                                $('.pagination li:eq(1)').removeClass('disabled');
                            }
                            else {
                                zonalizer.browse._previous = null;
                                $('.pagination li:eq(0)').addClass('disabled');
                                $('.pagination li:eq(1)').addClass('disabled');
                            }

                            if (data.paging && typeof data.paging === 'object' && data.paging.next) {
                                zonalizer.browse._next = data.paging.next;
                                $('.pagination li:eq(2)').removeClass('disabled');
                            }
                            else {
                                zonalizer.browse._next = null;
                                $('.pagination li:eq(2)').addClass('disabled');
                            }

                            return;
                        }
                    }

                    zonalizer.browse.fail();
                });
            },
            display: function (analysis) {
                $('tbody').empty();
                var i = 1;
                $(analysis).each(function (index) {
                    var tr;
                    var health = $('<div class="progress"></div>');
                    if (this.status == 'done') {
                        tr = $('<tr style="cursor: pointer; cursor: hand"></tr>');
                        tr.data('zonalizer-id', this.id);
                        $('<td></td>').text(this.fqdn).appendTo(tr);

                        var total = this.summary.notice
                            + this.summary.warning
                            + this.summary.error
                            + this.summary.critical;
                        var warning = Math.floor((this.summary.warning*100)/total);
                        var danger = Math.floor(((this.summary.error+this.summary.critical)*100)/total);

                        if (total) {
                            if ((100-warning-danger) > 0) {
                                $('<div class="progress-bar progress-bar-info"></div>')
                                    .css('width', (100-warning-danger)+'%')
                                    .appendTo(health);
                            }
                            if (warning > 0) {
                                $('<div class="progress-bar progress-bar-warning"></div>')
                                    .css('width', warning+'%')
                                    .appendTo(health);
                            }
                            if (danger > 0) {
                                $('<div class="progress-bar progress-bar-danger"></div>')
                                    .css('width', danger+'%')
                                    .appendTo(health);
                            }
                        }
                        else {
                            $('<div class="progress-bar progress-bar-success" style="width: 100%"></div>')
                                .appendTo(health);
                        }
                    }
                    else {
                        tr = $('<tr></tr>');
                        $('<td></td>').text(this.fqdn).appendTo(tr);
                        $('<div class="progress-bar progress-bar-success progress-bar-muted" style="width: 100%"></div>')
                            .appendTo(health);
                    }
                    var td = $('<td></td>');
                    health.appendTo(td);
                    td.appendTo(tr);

                    var status = 'OK';
                    if (this.status == 'done') {
                        if (this.summary.critical) {
                            status = 'CRITICAL';
                        }
                        else if (this.summary.error) {
                            status = 'Error'
                        }
                        else if (this.summary.warning) {
                            status = 'Warning'
                        }
                        else if (this.summary.notice) {
                            status = 'Notice'
                        }
                    }
                    else if (this.status == 'failed') {
                        status = 'FAILED';
                    }
                    else if (this.status == 'stopped') {
                        status = 'Stopped';
                    }
                    else {
                        status = 'Unknown';
                    }
                    $('<td></td>').text(status).appendTo(tr);

                    var ipv = '';
                    if ( this.ipv4 ) {
                        ipv += '4';
                    }
                    if ( this.ipv6 ) {
                        ipv += ( ipv ? '/' : '' ) + '6';
                    }
                    $('<td></td>').text(ipv).appendTo(tr);

                    var seconds = Math.floor(((new Date()).getTime()/1000) - this.updated);
                    if (seconds < 60) {
                        $('<td></td>').text('Now').appendTo(tr);
                    }
                    else if (seconds < (60*60)) {
                        $('<td></td>').text(Math.floor(seconds/60)+'m').appendTo(tr);
                    }
                    else if (seconds < (60*60*24)) {
                        $('<td></td>').text(Math.floor(seconds/(60*60))+'h').appendTo(tr);
                    }
                    else if (seconds < (60*60*24*7)) {
                        $('<td></td>').text(Math.floor(seconds/(60*60*24))+'d').appendTo(tr);
                    }
                    else {
                        $('<td></td>').text(Math.floor(seconds/(60*60*24*7))+'w').appendTo(tr);
                    }

                    tr.appendTo($('tbody'));
                });
            }
        },
        page: {
            main: function () {
                $(document).on({
                    'show': function() {
                        zonalizer.status.resume();
                    },
                    'hide': function() {
                        zonalizer.status.pause();
                    }
                });

                $('.jumbotron .progress, .alert, .table, .jumbotron > div > div:eq(1) > button').hide();
                $('.alert button').click(function () {
                    $('.alert').fadeOut('fast');
                });

                $('form:eq(0) button:eq(0)').click(function () {
                    $('.options').toggle();
                });
                $('#ipv4').click(function () {
                    $('#ipv6').not(':checked').prop('checked', true);
                });
                $('#ipv6').click(function () {
                    $('#ipv4').not(':checked').prop('checked', true);
                });

                $('form:eq(0) button:eq(1)').prop('disabled', true);
                var f = function() {
                    var zone = $('input:eq(0)').val();

                    if (zone && zone.match(/^[a-zA-Z0-9\.-]+$/)) {
                        $('form:eq(0) button:eq(1)').prop('disabled', false);
                    }
                    else {
                        $('form:eq(0) button:eq(1)').prop('disabled', true);
                    }
                };
                $('input:eq(0)').on('input propertychange paste', f);
                f();
                $('form:eq(0)').submit(function (event) {
                    var zone = $('input:eq(0)').val();

                    if (zone && zone.match(/^[a-zA-Z0-9\.-]+$/)) {
                        $('.options').hide();
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

                $('.nav-pills .dropdown .dropdown-menu a:eq(0)').click(function () {
                    $('.nav-pills .dropdown .dropdown-menu li').removeClass('active');
                    $('.nav-pills .dropdown .dropdown-menu li:eq(0)').addClass('active');
                    zonalizer.analyze.switchLang('en_US');
                });
                $('.nav-pills .dropdown .dropdown-menu a:eq(1)').click(function () {
                    $('.nav-pills .dropdown .dropdown-menu li').removeClass('active');
                    $('.nav-pills .dropdown .dropdown-menu li:eq(1)').addClass('active');
                    zonalizer.analyze.switchLang('fr_FR');
                });
                $('.nav-pills .dropdown .dropdown-menu a:eq(2)').click(function () {
                    $('.nav-pills .dropdown .dropdown-menu li').removeClass('active');
                    $('.nav-pills .dropdown .dropdown-menu li:eq(2)').addClass('active');
                    zonalizer.analyze.switchLang('sv_SE');
                });

                $('.nav-pills > li:eq(1) > a').click(function (event) {
                    zonalizer.analyze.toggle('all');
                    event.preventDefault();
                    return false;
                });
                $('.nav-pills > li:eq(2) > a').click(function (event) {
                    zonalizer.analyze.toggle('info');
                    event.preventDefault();
                    return false;
                });
                $('.nav-pills > li:eq(3) > a').click(function (event) {
                    zonalizer.analyze.toggle('notice');
                    event.preventDefault();
                    return false;
                });
                $('.nav-pills > li:eq(4) > a').click(function (event) {
                    zonalizer.analyze.toggle('warning');
                    event.preventDefault();
                    return false;
                });
                $('.nav-pills > li:eq(5) > a').click(function (event) {
                    zonalizer.analyze.toggle('error');
                    event.preventDefault();
                    return false;
                });
                $('.nav-pills > li:eq(6) > a').click(function (event) {
                    zonalizer.analyze.toggle('critical');
                    event.preventDefault();
                    return false;
                });

                if (window.location.search.match(/^\?[a-zA-Z0-9_=\-]+$/)) {
                    zonalizer.analyze.load(window.location.search.substr(1));
                }
                else {
                    zonalizer.status.start();
                }
            },
            browse: function () {
                $('.alert').hide();
                zonalizer.browse.init();
                zonalizer.browse.load();
            }
        }
    };

    $.fn.zonalizer = function (page) {
        zonalizer.page[page]();
        return this;
    };
}( jQuery ));
